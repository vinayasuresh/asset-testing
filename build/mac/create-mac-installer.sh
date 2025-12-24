#!/bin/bash
# ============================================
# macOS ITAM Agent Installer Generator
# Generates a self-contained .sh installer
# Can run on Linux server (no pkgbuild needed)
# ============================================

set -e

# Check parameters
if [ "$#" -lt 2 ]; then
    echo "Usage: $0 <enrollment_token> <itam_server_url> [output_file]"
    echo "Example: $0 'abc123token' 'https://itam.example.com' '/tmp/itam-agent-macos.sh'"
    exit 1
fi

ENROLLMENT_TOKEN="$1"
ITAM_SERVER_URL="$2"
OUTPUT_FILE="${3:-./itam-agent-macos.sh}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Creating macOS installer..."
echo "Token: ${ENROLLMENT_TOKEN:0:8}..."
echo "Server: $ITAM_SERVER_URL"
echo "Output: $OUTPUT_FILE"

# Create the installer script
cat > "$OUTPUT_FILE" << 'EOFINSTALLER'
#!/bin/bash
# ============================================
# ITAM Agent Installer for macOS
# Auto-generated installer
# ============================================

set -e

# Configuration (embedded during build)
ENROLLMENT_TOKEN="__ENROLLMENT_TOKEN__"
ITAM_SERVER_URL="__ITAM_SERVER_URL__"
OA_URL="https://open-audit.vistrivetech.com/index.php/input/devices"

INSTALL_DIR="/usr/local/ITAM"
LOG_FILE="/var/log/itam-agent-install.log"

echo "============================================"
echo "ITAM Agent Installation for macOS"
echo "============================================"
echo ""

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: This installer must be run with sudo"
    echo "Usage: sudo bash $0"
    exit 1
fi

# Create installation directory
echo "Creating installation directory..."
mkdir -p "$INSTALL_DIR"
chmod 755 "$INSTALL_DIR"

# Create log file
touch "$LOG_FILE"
chmod 644 "$LOG_FILE"

echo "Installation directory: $INSTALL_DIR" | tee -a "$LOG_FILE"
echo "Log file: $LOG_FILE" | tee -a "$LOG_FILE"
echo ""

# Save configuration
cat > "$INSTALL_DIR/enrollment.conf" << EOFCONF
ENROLLMENT_TOKEN="$ENROLLMENT_TOKEN"
ITAM_SERVER_URL="$ITAM_SERVER_URL"
EOFCONF

chmod 600 "$INSTALL_DIR/enrollment.conf"
echo "✓ Configuration saved" | tee -a "$LOG_FILE"

# Create the audit script (embedded Open-AudIT script)
echo "Installing audit script..." | tee -a "$LOG_FILE"

cat > "$INSTALL_DIR/oa_audit_macos.sh" << 'EOFAUDIT'
EOFINSTALLER

# Embed the actual Open-AudIT audit script
cat "$SCRIPT_DIR/pkgroot/usr/local/ITAM/oa_audit_macos.sh" >> "$OUTPUT_FILE"

# Continue with the installer
cat >> "$OUTPUT_FILE" << 'EOFINSTALLER2'
EOFAUDIT

chmod +x "$INSTALL_DIR/oa_audit_macos.sh"
echo "✓ Audit script installed" | tee -a "$LOG_FILE"

# Run the audit immediately to enroll the device
echo "" | tee -a "$LOG_FILE"
echo "============================================" | tee -a "$LOG_FILE"
echo "Running device audit and enrollment..." | tee -a "$LOG_FILE"
echo "============================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Change to /tmp so the audit script can write its XML file
cd /tmp

# Export environment variables for the audit script
export ENROLLMENT_TOKEN
export ITAM_SERVER_URL

# Run the audit script
if "$INSTALL_DIR/oa_audit_macos.sh" >> "$LOG_FILE" 2>&1; then
    echo "" | tee -a "$LOG_FILE"
    echo "✓ Device audit completed successfully" | tee -a "$LOG_FILE"
    echo "✓ Device enrolled in Open-AudIT" | tee -a "$LOG_FILE"
    echo "✓ Device enrolled in ITAM application" | tee -a "$LOG_FILE"
else
    echo "" | tee -a "$LOG_FILE"
    echo "⚠ Warning: Audit script exited with errors" | tee -a "$LOG_FILE"
    echo "  Check $LOG_FILE for details" | tee -a "$LOG_FILE"
fi

echo "" | tee -a "$LOG_FILE"
echo "============================================" | tee -a "$LOG_FILE"
echo "Installation Complete!" | tee -a "$LOG_FILE"
echo "============================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "Your device is now registered with:" | tee -a "$LOG_FILE"
echo "  • Open-AudIT: $OA_URL" | tee -a "$LOG_FILE"
echo "  • ITAM Application: $ITAM_SERVER_URL" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "Installation log: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

exit 0
EOFINSTALLER2

# Replace placeholders with actual values
sed -i.bak "s|__ENROLLMENT_TOKEN__|$ENROLLMENT_TOKEN|g" "$OUTPUT_FILE"
sed -i.bak "s|__ITAM_SERVER_URL__|$ITAM_SERVER_URL|g" "$OUTPUT_FILE"
rm -f "${OUTPUT_FILE}.bak"

# Make executable
chmod +x "$OUTPUT_FILE"

echo ""
echo "✓ macOS installer created successfully!"
echo "  Location: $OUTPUT_FILE"
echo ""
echo "To test locally:"
echo "  sudo bash $OUTPUT_FILE"
echo ""
echo "To distribute:"
echo "  Upload to your web server and have users run:"
echo "  curl -fsSL <URL> | sudo bash"
echo ""
