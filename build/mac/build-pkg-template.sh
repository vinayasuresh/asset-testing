#!/bin/bash
# ============================================
# Build macOS PKG Template (Run ONCE on macOS)
# ============================================
# This creates a reusable .pkg installer that can be
# customized on Linux servers via postinstall injection

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/pkg-build"
OUTPUT_DIR="$SCRIPT_DIR/../../static/installers"

echo "Building macOS PKG Template..."
echo "This needs to run on a macOS machine with pkgbuild available"
echo ""

# Verify we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "ERROR: This script must run on macOS"
    echo "Please run this on a Mac, then copy the resulting .pkg to your Linux server"
    exit 1
fi

# Verify pkgbuild exists
if ! command -v pkgbuild &> /dev/null; then
    echo "ERROR: pkgbuild not found"
    echo "This tool should be available on macOS by default"
    exit 1
fi

# Clean previous build
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/payload"
mkdir -p "$BUILD_DIR/scripts"
mkdir -p "$OUTPUT_DIR"

echo "Step 1: Copying payload files..."
# Copy the audit script to payload
mkdir -p "$BUILD_DIR/payload/usr/local/ITAM"
cp "$SCRIPT_DIR/pkgroot/usr/local/ITAM/oa_audit_macos.sh" "$BUILD_DIR/payload/usr/local/ITAM/"
chmod +x "$BUILD_DIR/payload/usr/local/ITAM/oa_audit_macos.sh"

echo "Step 2: Copying postinstall script..."
# Use the nonce-based postinstall script
cp "$SCRIPT_DIR/scripts/postinstall" "$BUILD_DIR/scripts/postinstall"
chmod +x "$BUILD_DIR/scripts/postinstall"

echo "Step 3: Building PKG with pkgbuild..."
pkgbuild \
    --root "$BUILD_DIR/payload" \
    --scripts "$BUILD_DIR/scripts" \
    --identifier "com.pionedata.itam-agent" \
    --version "1.0.0" \
    --install-location "/" \
    "$OUTPUT_DIR/itam-agent-macos-template.pkg"

echo ""
echo "========================================="
echo "✓ PKG Template built successfully!"
echo "========================================="
echo ""
echo "Template location:"
echo "  $OUTPUT_DIR/itam-agent-macos-template.pkg"
echo ""
echo "Next steps:"
echo "1. Copy this .pkg to your Linux server"
echo "2. Place it in: static/installers/"
echo "3. The server will inject enrollment tokens dynamically"
echo ""
echo "File size: $(du -h "$OUTPUT_DIR/itam-agent-macos-template.pkg" | cut -f1)"
echo ""

# Clean up build directory
rm -rf "$BUILD_DIR"

echo "Build complete!"
