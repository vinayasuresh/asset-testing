#!/bin/bash
# ITAM Agent Install Script for Linux
# This script installs the OpenAudit audit script and runs it

set -e

INSTALL_DIR="/opt/itam-agent"
SCRIPT_NAME="audit_linux.sh"
LOG_FILE="/var/log/itam-agent-install.log"

echo "========================================" | tee -a "$LOG_FILE"
echo "ITAM Agent Installation for Linux" | tee -a "$LOG_FILE"
echo "Started: $(date)" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "ERROR: This script must be run as root (use sudo)" | tee -a "$LOG_FILE"
    exit 1
fi

# Create installation directory
echo "Creating installation directory: $INSTALL_DIR" | tee -a "$LOG_FILE"
mkdir -p "$INSTALL_DIR"

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Copy the audit script
echo "Copying audit script..." | tee -a "$LOG_FILE"
if [ -f "$SCRIPT_DIR/$SCRIPT_NAME" ]; then
    cp "$SCRIPT_DIR/$SCRIPT_NAME" "$INSTALL_DIR/"
    chmod +x "$INSTALL_DIR/$SCRIPT_NAME"
    echo "Audit script copied successfully" | tee -a "$LOG_FILE"
else
    echo "ERROR: Audit script not found at $SCRIPT_DIR/$SCRIPT_NAME" | tee -a "$LOG_FILE"
    exit 1
fi

# Run the audit script
echo "========================================" | tee -a "$LOG_FILE"
echo "Running OpenAudit audit script..." | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"

cd "$INSTALL_DIR"
bash "$INSTALL_DIR/$SCRIPT_NAME" 2>&1 | tee -a "$LOG_FILE"

AUDIT_EXIT_CODE=${PIPESTATUS[0]}

echo "========================================" | tee -a "$LOG_FILE"
if [ $AUDIT_EXIT_CODE -eq 0 ]; then
    echo "SUCCESS: Audit completed successfully" | tee -a "$LOG_FILE"
    echo "Your Linux device has been added to the asset inventory" | tee -a "$LOG_FILE"
else
    echo "WARNING: Audit script exited with code $AUDIT_EXIT_CODE" | tee -a "$LOG_FILE"
    echo "Check the log for details: $LOG_FILE" | tee -a "$LOG_FILE"
fi
echo "Installation completed: $(date)" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"

exit 0
