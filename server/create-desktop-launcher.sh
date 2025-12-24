#!/bin/bash
# This script creates a .desktop launcher for the ITAM installer

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
INSTALLER_PATH="$HOME/Downloads/itam-agent-linux-gui.sh"

# Create .desktop file in Downloads
cat > "$HOME/Downloads/Install-ITAM-Agent.desktop" << 'EOF'
[Desktop Entry]
Version=1.0
Type=Application
Name=Install ITAM Agent
Comment=Install IT Asset Management Agent on this device
Exec=bash -c 'INSTALLER="$HOME/Downloads/itam-agent-linux-gui.sh"; if [ -f "$INSTALLER" ]; then chmod +x "$INSTALLER"; if command -v gnome-terminal >/dev/null; then gnome-terminal -- bash -c "sudo \"$INSTALLER\"; echo; echo \"Press Enter to close...\"; read"; elif command -v konsole >/dev/null; then konsole -e bash -c "sudo \"$INSTALLER\"; echo; echo \"Press Enter to close...\"; read"; elif command -v xterm >/dev/null; then xterm -e bash -c "sudo \"$INSTALLER\"; echo; echo \"Press Enter to close...\"; read"; else sudo "$INSTALLER"; fi; else zenity --error --text="Installer not found at: $INSTALLER"; fi'
Icon=system-software-install
Terminal=false
Categories=System;Settings;
EOF

# Make it executable
chmod +x "$HOME/Downloads/Install-ITAM-Agent.desktop"

echo "Desktop launcher created: $HOME/Downloads/Install-ITAM-Agent.desktop"
echo "Double-click it to install!"
