#!/bin/bash
# ITAM Agent GUI Installer Launcher for Linux
# This script creates a desktop launcher that users can double-click

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DESKTOP_FILE="$HOME/Desktop/ITAM-Agent-Installer.desktop"
INSTALLER_SCRIPT="$SCRIPT_DIR/itam-agent-linux.sh"

# Check if installer script exists
if [ ! -f "$INSTALLER_SCRIPT" ]; then
    echo "ERROR: Installer script not found at $INSTALLER_SCRIPT"
    exit 1
fi

# Create desktop launcher file
cat > "$DESKTOP_FILE" << 'EOF'
[Desktop Entry]
Version=1.0
Type=Application
Name=ITAM Agent Installer
Comment=Install ITAM Agent to register this device
Exec=sh -c 'if command -v pkexec >/dev/null 2>&1; then pkexec bash "$(dirname "$0")/install-with-gui.sh"; elif command -v gksudo >/dev/null 2>&1; then gksudo bash "$(dirname "$0")/install-with-gui.sh"; elif command -v kdesudo >/dev/null 2>&1; then kdesudo bash "$(dirname "$0")/install-with-gui.sh"; else xterm -e "sudo bash $(dirname "$0")/install-with-gui.sh; read -p \"Press Enter to close...\""; fi'
Icon=system-software-install
Terminal=false
Categories=System;
EOF

# Make desktop file executable
chmod +x "$DESKTOP_FILE"

# Try to mark as trusted (Ubuntu/GNOME)
if command -v gio >/dev/null 2>&1; then
    gio set "$DESKTOP_FILE" metadata::trusted true 2>/dev/null || true
fi

echo "Desktop launcher created: $DESKTOP_FILE"
echo "Users can now double-click the icon to install."
