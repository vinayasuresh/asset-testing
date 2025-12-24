#!/bin/bash
# ITAM Agent GUI Installer - Embedded in .desktop launcher
# This script handles privilege elevation, GUI dialogs, and installation
set -e

INSTALL_DIR="/opt/itam-agent"
LOG_FILE="/var/log/itam-agent-install.log"
INSTALLER_URL="${INSTALLER_URL:-}"
ALREADY_INSTALLED_MARKER="/opt/itam-agent/.installed"

# GUI Helper Functions
show_dialog() {
    local type="$1"  # info, warning, error, question
    local title="$2"
    local message="$3"
    
    if command -v zenity >/dev/null 2>&1; then
        case "$type" in
            question)
                zenity --question --title="$title" --text="$message" --width=400 2>/dev/null
                return $?
                ;;
            error)
                zenity --error --title="$title" --text="$message" --width=400 2>/dev/null
                ;;
            warning)
                zenity --warning --title="$title" --text="$message" --width=400 2>/dev/null
                ;;
            *)
                zenity --info --title="$title" --text="$message" --width=400 2>/dev/null
                ;;
        esac
    elif command -v kdialog >/dev/null 2>&1; then
        case "$type" in
            question)
                kdialog --title "$title" --yesno "$message" 2>/dev/null
                return $?
                ;;
            error)
                kdialog --title "$title" --error "$message" 2>/dev/null
                ;;
            warning)
                kdialog --title "$title" --sorry "$message" 2>/dev/null
                ;;
            *)
                kdialog --title "$title" --msgbox "$message" 2>/dev/null
                ;;
        esac
    elif command -v notify-send >/dev/null 2>&1; then
        notify-send "$title" "$message" 2>/dev/null
        [ "$type" = "question" ] && return 1
    else
        echo "$title: $message" >&2
        [ "$type" = "question" ] && return 1
    fi
}

show_progress() {
    local message="$1"
    if command -v zenity >/dev/null 2>&1; then
        (
            echo "10"; echo "# Downloading installer..."
            sleep 1
            echo "30"; echo "# Extracting files..."
            sleep 1
            echo "50"; echo "# Running device audit..."
            sleep 3
            echo "80"; echo "# Registering with server..."
            sleep 1
            echo "100"; echo "# Installation complete!"
        ) | zenity --progress --title="ITAM Agent Installation" --text="$message" --percentage=0 --auto-close --width=400 2>/dev/null
    elif command -v kdialog >/dev/null 2>&1; then
        kdialog --title "ITAM Agent Installation" --passivepopup "$message" 5 2>/dev/null
    fi
}

# Check if already installed
check_if_installed() {
    if [ -f "$ALREADY_INSTALLED_MARKER" ]; then
        show_dialog "info" "ITAM Agent" "The ITAM Agent is already installed on this device.\n\nInstalled: $(cat "$ALREADY_INSTALLED_MARKER" 2>/dev/null || echo 'Unknown date')\n\nNo action needed."
        exit 0
    fi
}

# Main installation function (runs as root)
run_installation() {
    echo "========================================" | tee "$LOG_FILE"
    echo "ITAM Agent Installation" | tee -a "$LOG_FILE"
    echo "Started: $(date)" | tee -a "$LOG_FILE"
    echo "========================================" | tee -a "$LOG_FILE"
    
    # Create install directory
    mkdir -p "$INSTALL_DIR" 2>&1 | tee -a "$LOG_FILE"
    
    # Download and extract installer
    TEMP_INSTALLER="/tmp/itam-agent-installer-$$.sh"
    
    if [ -n "$INSTALLER_URL" ]; then
        echo "Downloading installer from $INSTALLER_URL..." | tee -a "$LOG_FILE"
        if command -v curl >/dev/null 2>&1; then
            curl -sL "$INSTALLER_URL" -o "$TEMP_INSTALLER" 2>&1 | tee -a "$LOG_FILE"
        elif command -v wget >/dev/null 2>&1; then
            wget -q "$INSTALLER_URL" -O "$TEMP_INSTALLER" 2>&1 | tee -a "$LOG_FILE"
        else
            echo "ERROR: Neither curl nor wget available" | tee -a "$LOG_FILE"
            return 1
        fi
    else
        # Extract from embedded payload
        PAYLOAD_LINE=$(awk '/^__PAYLOAD_BEGIN__/ {print NR + 1; exit 0; }' "$0")
        if [ -n "$PAYLOAD_LINE" ]; then
            tail -n +${PAYLOAD_LINE} "$0" | base64 -d > "$TEMP_INSTALLER"
        else
            echo "ERROR: No installer payload found" | tee -a "$LOG_FILE"
            return 1
        fi
    fi
    
    if [ ! -f "$TEMP_INSTALLER" ] || [ ! -s "$TEMP_INSTALLER" ]; then
        echo "ERROR: Failed to get installer" | tee -a "$LOG_FILE"
        return 1
    fi
    
    # Make installer executable and run it
    chmod +x "$TEMP_INSTALLER"
    
    # Extract and run the installer
    EXTRACT_DIR="/tmp/itam-agent-$$"
    mkdir -p "$EXTRACT_DIR"
    
    # Check if it's a self-extracting script
    if grep -q "__PAYLOAD_BEGIN__" "$TEMP_INSTALLER"; then
        PAYLOAD_LINE=$(awk '/^__PAYLOAD_BEGIN__/ {print NR + 1; exit 0; }' "$TEMP_INSTALLER")
        tail -n +${PAYLOAD_LINE} "$TEMP_INSTALLER" | base64 -d | tar -xzf - -C "$EXTRACT_DIR" 2>&1 | tee -a "$LOG_FILE"
    else
        # Direct script
        cp "$TEMP_INSTALLER" "$EXTRACT_DIR/audit_linux.sh"
    fi
    
    # Find the audit script
    AUDIT_SCRIPT=""
    for script in "$EXTRACT_DIR/audit_linux.sh" "$EXTRACT_DIR/agent/audit_linux.sh"; do
        if [ -f "$script" ]; then
            AUDIT_SCRIPT="$script"
            break
        fi
    done
    
    if [ -z "$AUDIT_SCRIPT" ]; then
        echo "ERROR: Audit script not found" | tee -a "$LOG_FILE"
        rm -rf "$EXTRACT_DIR" "$TEMP_INSTALLER"
        return 1
    fi
    
    # Copy audit script to install directory
    cp "$AUDIT_SCRIPT" "$INSTALL_DIR/audit_linux.sh"
    chmod +x "$INSTALL_DIR/audit_linux.sh"
    
    echo "Running device audit..." | tee -a "$LOG_FILE"
    cd "$INSTALL_DIR"
    bash "$INSTALL_DIR/audit_linux.sh" 2>&1 | tee -a "$LOG_FILE"
    AUDIT_EXIT=$?
    
    # Mark as installed
    echo "$(date)" > "$ALREADY_INSTALLED_MARKER"
    
    # Cleanup
    rm -rf "$EXTRACT_DIR" "$TEMP_INSTALLER"
    
    echo "========================================" | tee -a "$LOG_FILE"
    echo "Installation completed: $(date)" | tee -a "$LOG_FILE"
    echo "Audit exit code: $AUDIT_EXIT" | tee -a "$LOG_FILE"
    echo "========================================" | tee -a "$LOG_FILE"
    
    return $AUDIT_EXIT
}

# Privilege elevation with GUI
elevate_and_install() {
    # Try pkexec (PolicyKit - modern standard)
    if command -v pkexec >/dev/null 2>&1; then
        (show_progress "Installing ITAM Agent..." &)
        PROGRESS_PID=$!
        pkexec env DISPLAY="$DISPLAY" XAUTHORITY="$XAUTHORITY" HOME="$HOME" INSTALLER_URL="$INSTALLER_URL" bash -c "$(declare -f run_installation show_dialog); run_installation"
        INSTALL_EXIT=$?
        kill $PROGRESS_PID 2>/dev/null || true
        return $INSTALL_EXIT
    
    # Try gksudo (older Ubuntu/Debian)
    elif command -v gksudo >/dev/null 2>&1; then
        (show_progress "Installing ITAM Agent..." &)
        PROGRESS_PID=$!
        gksudo --description="ITAM Agent Installation" bash -c "INSTALLER_URL='$INSTALLER_URL' $(declare -f run_installation show_dialog); run_installation"
        INSTALL_EXIT=$?
        kill $PROGRESS_PID 2>/dev/null || true
        return $INSTALL_EXIT
    
    # Try kdesudo (KDE)
    elif command -v kdesudo >/dev/null 2>&1; then
        (show_progress "Installing ITAM Agent..." &)
        PROGRESS_PID=$!
        kdesudo --comment "ITAM Agent Installation" bash -c "INSTALLER_URL='$INSTALLER_URL' $(declare -f run_installation show_dialog); run_installation"
        INSTALL_EXIT=$?
        kill $PROGRESS_PID 2>/dev/null || true
        return $INSTALL_EXIT
    
    # No graphical sudo available - show instructions
    else
        show_dialog "warning" "Administrator Access Required" "This installation requires administrator privileges.\n\nA terminal window will open. Please enter your password when prompted."
        
        # Create a temporary script
        TEMP_SCRIPT="/tmp/itam-install-$$.sh"
        cat > "$TEMP_SCRIPT" << 'EOFSCRIPT'
#!/bin/bash
INSTALLER_URL="__INSTALLER_URL__"
__FUNCTIONS__
run_installation
INSTALL_EXIT=$?
echo ""
echo "========================================"
if [ $INSTALL_EXIT -eq 0 ]; then
    echo "Installation completed successfully!"
else
    echo "Installation completed with warnings (exit code: $INSTALL_EXIT)"
    echo "Check log: /var/log/itam-agent-install.log"
fi
echo "========================================"
echo ""
echo "Press Enter to close this window..."
read
exit $INSTALL_EXIT
EOFSCRIPT
        
        # Replace placeholders
        sed -i "s|__INSTALLER_URL__|$INSTALLER_URL|g" "$TEMP_SCRIPT"
        sed -i "s|__FUNCTIONS__|$(declare -f run_installation show_dialog)|g" "$TEMP_SCRIPT"
        chmod +x "$TEMP_SCRIPT"
        
        # Launch terminal
        if command -v gnome-terminal >/dev/null 2>&1; then
            gnome-terminal --title="ITAM Agent Installation" -- bash -c "sudo '$TEMP_SCRIPT'" 2>/dev/null
        elif command -v konsole >/dev/null 2>&1; then
            konsole --title "ITAM Agent Installation" -e bash -c "sudo '$TEMP_SCRIPT'" 2>/dev/null
        elif command -v xfce4-terminal >/dev/null 2>&1; then
            xfce4-terminal --title="ITAM Agent Installation" -e "bash -c \"sudo '$TEMP_SCRIPT'\"" 2>/dev/null
        elif command -v xterm >/dev/null 2>&1; then
            xterm -T "ITAM Agent Installation" -e bash -c "sudo '$TEMP_SCRIPT'" 2>/dev/null
        else
            show_dialog "error" "Error" "No terminal emulator found.\n\nPlease run this command in a terminal:\nsudo bash $TEMP_SCRIPT"
            return 1
        fi
        
        return 0
    fi
}

# Main script execution
main() {
    # Check if already installed
    if [ "$EUID" -ne 0 ]; then
        check_if_installed
    fi
    
    # If running as root, just install
    if [ "$EUID" -eq 0 ]; then
        run_installation
        exit $?
    fi
    
    # Show confirmation dialog
    if ! show_dialog "question" "Install ITAM Agent?" "This will install the IT Asset Management Agent on your device.\n\nThe installer will:\n• Register this device with IT Asset Management\n• Collect hardware and software inventory\n• Require administrator privileges\n\nDo you want to continue?"; then
        exit 0
    fi
    
    # Elevate and install
    if elevate_and_install; then
        show_dialog "info" "Installation Complete" "The ITAM Agent has been successfully installed!\n\nYour device is now registered with the IT Asset Management system.\n\nLog file: $LOG_FILE"
    else
        INSTALL_EXIT=$?
        if [ $INSTALL_EXIT -ne 0 ]; then
            show_dialog "warning" "Installation Warning" "Installation completed with warnings (exit code: $INSTALL_EXIT).\n\nYour device may still be registered.\n\nCheck log for details: $LOG_FILE"
        fi
    fi
}

# Run main
main "$@"
