#!/bin/bash
# ITAM Agent Self-Extracting Installer for Linux
# This script extracts and runs the installation

set -e

EXTRACT_DIR="/tmp/itam-agent-$$"
LOG_FILE="/var/log/itam-agent-install.log"

echo "========================================" | tee "$LOG_FILE"
echo "ITAM Asset Management - Linux Agent" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "" | tee -a "$LOG_FILE"
    echo "ERROR: This installer must be run with sudo privileges" | tee -a "$LOG_FILE"
    echo "Please run: sudo bash itam-agent-linux.sh" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    exit 1
fi

# Create temporary extraction directory
mkdir -p "$EXTRACT_DIR"
echo "Extracting installer files..." | tee -a "$LOG_FILE"

# The PAYLOAD_LINE will be set during build
PAYLOAD_LINE=$(awk '/^__PAYLOAD_BEGIN__/ {print NR + 1; exit 0; }' "$0")

# Extract the payload
tail -n +${PAYLOAD_LINE} "$0" | base64 -d | tar -xzf - -C "$EXTRACT_DIR"

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to extract installer files" | tee -a "$LOG_FILE"
    rm -rf "$EXTRACT_DIR"
    exit 1
fi

# Run the install script
cd "$EXTRACT_DIR"
bash install.sh

INSTALL_EXIT_CODE=$?

# Cleanup
echo "Cleaning up temporary files..." | tee -a "$LOG_FILE"
rm -rf "$EXTRACT_DIR"

echo "" | tee -a "$LOG_FILE"
if [ $INSTALL_EXIT_CODE -eq 0 ]; then
    echo "========================================" | tee -a "$LOG_FILE"
    echo "Installation Complete!" | tee -a "$LOG_FILE"
    echo "Your Linux device has been enrolled." | tee -a "$LOG_FILE"
    echo "========================================" | tee -a "$LOG_FILE"
else
    echo "Installation encountered issues. Check $LOG_FILE for details." | tee -a "$LOG_FILE"
fi

exit $INSTALL_EXIT_CODE

__PAYLOAD_BEGIN__
