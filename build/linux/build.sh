#!/bin/bash
# Build script for Linux ITAM Agent installer
# Creates both CLI and GUI installers

set -e

BUILD_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENT_DIR="$BUILD_DIR/agent"
OUTPUT_DIR="$BUILD_DIR/../../static/installers"
CLI_OUTPUT="$OUTPUT_DIR/itam-agent-linux.sh"
GUI_OUTPUT="$OUTPUT_DIR/itam-agent-linux-gui.sh"
CLI_TEMPLATE="$BUILD_DIR/installer-template.sh"
GUI_TEMPLATE="$BUILD_DIR/gui-installer-template.sh"

echo "========================================="
echo "Building ITAM Agent Linux Installers"
echo "========================================="

# Check if agent files exist
if [ ! -f "$AGENT_DIR/audit_linux.sh" ]; then
    echo "ERROR: audit_linux.sh not found in $AGENT_DIR"
    echo "Please add the OpenAudit Linux audit script to $AGENT_DIR/audit_linux.sh"
    exit 1
fi

if [ ! -f "$AGENT_DIR/install.sh" ]; then
    echo "ERROR: install.sh not found in $AGENT_DIR"
    exit 1
fi

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Create temporary directory for payload
TEMP_DIR=$(mktemp -d)
cp -r "$AGENT_DIR"/* "$TEMP_DIR/"

# Make scripts executable
chmod +x "$TEMP_DIR"/*.sh

# Create tarball and encode
cd "$TEMP_DIR"
PAYLOAD=$(tar -czf - . | base64)
cd - > /dev/null

echo ""
echo "Building CLI installer..."
# Combine CLI template with payload
cp "$CLI_TEMPLATE" "$CLI_OUTPUT"
echo "$PAYLOAD" >> "$CLI_OUTPUT"
chmod +x "$CLI_OUTPUT"
CLI_SIZE=$(du -h "$CLI_OUTPUT" | cut -f1)

echo "Building GUI installer..."
# Combine GUI template with payload  
cp "$GUI_TEMPLATE" "$GUI_OUTPUT"
echo "$PAYLOAD" >> "$GUI_OUTPUT"
chmod +x "$GUI_OUTPUT"
GUI_SIZE=$(du -h "$GUI_OUTPUT" | cut -f1)

# Cleanup
rm -rf "$TEMP_DIR"

echo "========================================="
echo "Build Complete!"
echo "========================================="
echo ""
echo "CLI Installer (Terminal): $CLI_OUTPUT"
echo "Size: $CLI_SIZE"
echo "Usage: sudo bash itam-agent-linux.sh"
echo ""
echo "GUI Installer (Double-click): $GUI_OUTPUT"
echo "Size: $GUI_SIZE"
echo "Usage: Make executable, then double-click"
echo ""
echo "The GUI installer will:"
echo "  • Show graphical progress dialog"
echo "  • Request sudo password via GUI"
echo "  • Display success/error messages"
echo "  • Work on most Linux desktop environments"
echo ""
echo "The CLI installer is for:"
echo "  • Server installations"
echo "  • Automated deployments"
echo "  • Systems without GUI"
echo "========================================="
