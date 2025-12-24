#!/bin/bash
# ITAM Agent GUI Installation Wrapper
# Shows a graphical progress dialog during installation
# Automatically requests admin privileges when double-clicked

# Detect if being run from terminal or double-clicked
if [ -t 0 ]; then
    IS_TERMINAL=true
else
    IS_TERMINAL=false
fi

INSTALL_DIR="/opt/itam-agent"
SCRIPT_NAME="audit_linux.sh"
LOG_FILE="/var/log/itam-agent-install.log"

# Function to show GUI message
show_message() {
    local title="$1"
    local message="$2"
    local type="${3:-info}"  # info, warning, error
    
    if command -v zenity >/dev/null 2>&1; then
        zenity --"$type" --title="$title" --text="$message" --width=400 2>/dev/null
    elif command -v kdialog >/dev/null 2>&1; then
        kdialog --title "$title" --msgbox "$message" 2>/dev/null
    elif command -v notify-send >/dev/null 2>&1; then
        notify-send "$title" "$message" 2>/dev/null
    else
        echo "$title: $message"
    fi
}

# Function to request admin privileges graphically
request_admin_privileges() {
    # If already root, continue
    if [ "$EUID" -eq 0 ]; then
        return 0
    fi
    
    # Try pkexec (PolicyKit - works on most modern distros)
    if command -v pkexec >/dev/null 2>&1; then
        pkexec env DISPLAY="$DISPLAY" XAUTHORITY="$XAUTHORITY" "$0" "$@"
        exit $?
    # Try gksudo (older Ubuntu/Debian)
    elif command -v gksudo >/dev/null 2>&1; then
        gksudo "$0 $@"
        exit $?
    # Try kdesudo (KDE)
    elif command -v kdesudo >/dev/null 2>&1; then
        kdesudo "$0 $@"
        exit $?
    # Try running in terminal with sudo
    elif [ "$IS_TERMINAL" = false ]; then
        # Not in terminal and no graphical sudo available - launch terminal
        if command -v gnome-terminal >/dev/null 2>&1; then
            gnome-terminal --title="ITAM Agent Installer" -- bash -c "echo 'Installing ITAM Agent...'; echo ''; sudo '$0' $@; STATUS=\$?; echo ''; if [ \$STATUS -eq 0 ]; then echo 'Installation completed successfully!'; else echo 'Installation failed. Error code:' \$STATUS; fi; echo ''; echo 'Press Enter to close...'; read" 2>/dev/null
            exit $?
        elif command -v konsole >/dev/null 2>&1; then
            konsole --title "ITAM Agent Installer" -e bash -c "echo 'Installing ITAM Agent...'; echo ''; sudo '$0' $@; STATUS=\$?; echo ''; if [ \$STATUS -eq 0 ]; then echo 'Installation completed successfully!'; else echo 'Installation failed. Error code:' \$STATUS; fi; echo ''; echo 'Press Enter to close...'; read" 2>/dev/null
            exit $?
        elif command -v xterm >/dev/null 2>&1; then
            xterm -T "ITAM Agent Installer" -e bash -c "echo 'Installing ITAM Agent...'; echo ''; sudo '$0' $@; STATUS=\$?; echo ''; if [ \$STATUS -eq 0 ]; then echo 'Installation completed successfully!'; else echo 'Installation failed. Error code:' \$STATUS; fi; echo ''; echo 'Press Enter to close...'; read" 2>/dev/null
            exit $?
        else
            show_message "ITAM Agent Installer" "Please open a terminal and run:\nsudo $0" "error"
            exit 1
        fi
    else
        # In terminal, just show error
        echo "ERROR: This installer requires sudo privileges."
        echo "Please run: sudo $0"
        exit 1
    fi
}

# Request admin privileges if not already root
request_admin_privileges "$@"

# Function to ask yes/no question
ask_question() {
    local message="$1"
    if command -v zenity >/dev/null 2>&1; then
        zenity --question --title="ITAM Agent Installer" --text="$message" --width=400 2>/dev/null
        return $?
    elif command -v kdialog >/dev/null 2>&1; then
        kdialog --title "ITAM Agent Installer" --yesno "$message" 2>/dev/null
        return $?
    else
        return 1
    fi
}

# Function to run with GUI terminal
run_in_terminal() {
    local script_path="$1"
    
    # Try different terminal emulators
    if command -v gnome-terminal >/dev/null 2>&1; then
        gnome-terminal -- bash -c "sudo '$script_path'; echo; echo 'Press Enter to close...'; read" 2>/dev/null &
    elif command -v konsole >/dev/null 2>&1; then
        konsole -e bash -c "sudo '$script_path'; echo; echo 'Press Enter to close...'; read" 2>/dev/null &
    elif command -v xterm >/dev/null 2>&1; then
        xterm -e bash -c "sudo '$script_path'; echo; echo 'Press Enter to close...'; read" 2>/dev/null &
    else
        show_message "Error" "No terminal emulator found.\n\nPlease run in terminal:\nsudo $script_path" "error"
        exit 1
    fi
}


# Function to show progress
show_progress() {
    local message="$1"
    if command -v zenity >/dev/null 2>&1; then
        (
            echo "10"; echo "# Creating installation directory..."
            sleep 1
            echo "30"; echo "# Extracting files..."
            sleep 1
            echo "50"; echo "# Running device audit..."
            sleep 2
            echo "80"; echo "# Registering with server..."
            sleep 1
            echo "100"; echo "# Installation complete!"
        ) | zenity --progress --title="ITAM Agent Installation" --text="Installing..." --percentage=0 --auto-close --width=400 2>/dev/null
    fi
}

# Now we're running as root - proceed with installation
echo "========================================" | tee "$LOG_FILE"
echo "ITAM Agent Installation Started" | tee -a "$LOG_FILE"
echo "Started: $(date)" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"

# Show progress in background (if GUI available)
if [ "$IS_TERMINAL" = false ]; then
    show_progress &
    PROGRESS_PID=$!
else
    PROGRESS_PID=""
fi

# Create installation directory
echo "Creating installation directory: $INSTALL_DIR" | tee -a "$LOG_FILE"
mkdir -p "$INSTALL_DIR" 2>&1 | tee -a "$LOG_FILE"

# Extract the installer from the self-extracting script
PAYLOAD_LINE=$(awk '/^__PAYLOAD_BEGIN__/ {print NR + 1; exit 0; }' "$0")
EXTRACT_DIR="/tmp/itam-agent-$$"
mkdir -p "$EXTRACT_DIR"

echo "Extracting installer files..." | tee -a "$LOG_FILE"
tail -n +${PAYLOAD_LINE} "$0" | base64 -d | tar -xzf - -C "$EXTRACT_DIR" 2>&1 | tee -a "$LOG_FILE"

if [ $? -ne 0 ]; then
    [ -n "$PROGRESS_PID" ] && kill $PROGRESS_PID 2>/dev/null
    show_message "Installation Error" "Failed to extract installer files.\n\nCheck log: $LOG_FILE" "error"
    rm -rf "$EXTRACT_DIR"
    exit 1
fi

# Find and copy the audit script
FOUND_SCRIPT=""
for script in "$EXTRACT_DIR/$SCRIPT_NAME" "$EXTRACT_DIR/agent/$SCRIPT_NAME"; do
    if [ -f "$script" ]; then
        FOUND_SCRIPT="$script"
        break
    fi
done

if [ -n "$FOUND_SCRIPT" ]; then
    echo "Copying audit script from $FOUND_SCRIPT..." | tee -a "$LOG_FILE"
    cp "$FOUND_SCRIPT" "$INSTALL_DIR/"
    chmod +x "$INSTALL_DIR/$SCRIPT_NAME"
    echo "Audit script installed successfully" | tee -a "$LOG_FILE"
else
    [ -n "$PROGRESS_PID" ] && kill $PROGRESS_PID 2>/dev/null
    show_message "Installation Error" "Audit script not found in installer package.\n\nCheck log: $LOG_FILE" "error"
    rm -rf "$EXTRACT_DIR"
    exit 1
fi

# Run the audit
echo "========================================" | tee -a "$LOG_FILE"
echo "Running device audit..." | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
cd "$INSTALL_DIR"
bash "$INSTALL_DIR/$SCRIPT_NAME" 2>&1 | tee -a "$LOG_FILE"
AUDIT_EXIT_CODE=${PIPESTATUS[0]}

# Cleanup
rm -rf "$EXTRACT_DIR"

# Kill progress dialog
[ -n "$PROGRESS_PID" ] && kill $PROGRESS_PID 2>/dev/null

echo "========================================" | tee -a "$LOG_FILE"
echo "Installation Process Complete" | tee -a "$LOG_FILE"
echo "Completed: $(date)" | tee -a "$LOG_FILE"
echo "Audit Exit Code: $AUDIT_EXIT_CODE" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"

# Show result
if [ $AUDIT_EXIT_CODE -eq 0 ]; then
    show_message "Installation Complete!" "Your device has been successfully registered with the IT Asset Management system.\n\nInstallation log: $LOG_FILE" "info"
    echo "SUCCESS: Installation completed successfully" | tee -a "$LOG_FILE"
    exit 0
else
    show_message "Installation Warning" "Installation completed with warnings (exit code: $AUDIT_EXIT_CODE).\n\nYour device may still be registered.\nCheck log for details: $LOG_FILE" "warning"
    echo "WARNING: Audit exited with code $AUDIT_EXIT_CODE" | tee -a "$LOG_FILE"
    exit 0  # Don't fail - device likely still registered
fi

__PAYLOAD_BEGIN__

__PAYLOAD_BEGIN__
