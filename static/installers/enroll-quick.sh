#!/bin/bash
# Quick macOS Device Enrollment Script
# Usage: curl http://localhost:5050/enroll-direct/TOKEN | sudo bash

set -e

# Get enrollment token from environment or first argument
ENROLLMENT_TOKEN="${ENROLLMENT_TOKEN:-$1}"

if [ -z "$ENROLLMENT_TOKEN" ]; then
    echo "ERROR: Enrollment token not provided"
    echo "Usage: curl http://localhost:5050/enroll-direct/TOKEN | sudo bash"
    exit 1
fi

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "ERROR: This script must be run with sudo"
    exit 1
fi

echo "========================================"
echo "ITAM Agent - Quick Enrollment"
echo "========================================"
echo ""

# Collect system information
HOSTNAME=$(hostname -s)
SERIAL=$(ioreg -l | grep IOPlatformSerialNumber | awk '{print $4}' | sed 's/"//g' || echo "UNKNOWN")
OS_NAME=$(sw_vers -productName)
OS_VERSION=$(sw_vers -productVersion)
USERNAME=$(stat -f%Su /dev/console)
IP_ADDRESSES=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | tr '\n' ',' | sed 's/,$//')

echo "📋 Device Information:"
echo "   Hostname: $HOSTNAME"
echo "   Serial: $SERIAL"
echo "   OS: $OS_NAME $OS_VERSION"
echo "   User: $USERNAME"
echo "   IPs: $IP_ADDRESSES"
echo ""

# Determine server URL (check if token has full URL or just token)
if [[ "$ENROLLMENT_TOKEN" == http* ]]; then
    # Full URL provided
    SERVER_URL=$(echo "$ENROLLMENT_TOKEN" | sed 's|/enroll-direct/.*||')
    TOKEN=$(echo "$ENROLLMENT_TOKEN" | sed 's|.*/enroll-direct/||')
else
    # Just token provided, use localhost
    SERVER_URL="http://localhost:5050"
    TOKEN="$ENROLLMENT_TOKEN"
fi

ENROLL_URL="${SERVER_URL}/api/agent/enroll"

echo "📤 Enrolling device..."
echo "   Server: $SERVER_URL"
echo "   Token: ${TOKEN:0:8}..."
echo ""

# Create JSON payload
JSON_PAYLOAD=$(cat <<EOF
{
  "hostname": "$HOSTNAME",
  "serial": "$SERIAL",
  "enrollmentToken": "$TOKEN",
  "os": {
    "name": "$OS_NAME",
    "version": "$OS_VERSION"
  },
  "username": "$USERNAME",
  "ips": ["$IP_ADDRESSES"]
}
EOF
)

# Send enrollment request
RESPONSE=$(curl -s -X POST "$ENROLL_URL" \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD" \
  -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')

echo "📥 Server Response:"
echo "$RESPONSE_BODY" | head -20
echo ""

if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ]; then
    echo "✅ SUCCESS! Device enrolled successfully"
    echo ""
    echo "🎉 Your device is now registered in the IT Asset Management system"
    echo "   You can view it in the Assets dashboard"
    exit 0
else
    echo "❌ FAILED! Enrollment failed with HTTP status: $HTTP_STATUS"
    echo ""
    echo "Response:"
    echo "$RESPONSE_BODY"
    exit 1
fi
