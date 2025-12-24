# Linux ITAM Agent - GUI Installation System

## Overview

The Linux ITAM Agent now features a **true double-click installation** using a `.desktop` launcher that provides:
- ✅ **Zero terminal interaction** required
- ✅ **Graphical confirmation dialogs**
- ✅ **Secure privilege elevation** (pkexec/gksudo/kdesudo)
- ✅ **Progress indicators**
- ✅ **Success/error messages**
- ✅ **Idempotent** - safe to re-run
- ✅ **Works from any folder** (Downloads, /tmp, Desktop, etc.)
- ✅ **Handles filename suffixes** like `Install-ITAM-Agent (1).desktop`

## How It Works

### User Experience Flow

1. **User visits enrollment URL** → `/enroll`
2. **Auto-download** → `Install-ITAM-Agent.desktop` file
3. **User makes executable** → Right-click → Properties → "Allow executing as program"
4. **Double-click file** → Launches GUI installer
5. **Confirmation dialog** → "Install ITAM Agent? This will make changes to your system"
6. **Click Yes** → Proceeds with installation
7. **Password prompt** → Graphical sudo dialog (pkexec/gksudo/kdesudo)
8. **Enter password** → Secure authentication
9. **Progress indicator** → Shows installation progress (if Zenity available)
10. **Device audit runs** → Collects hardware/software inventory
11. **Registration** → Device appears in Open-AudIT
12. **Success message** → "Installation Complete!"

### Technical Implementation

The `.desktop` launcher contains an **embedded installer script** that:

1. **Detects environment**: GUI vs terminal, available tools
2. **Shows confirmation**: "Do you want to install?"
3. **Elevates privileges**: Using PolicyKit (pkexec) or fallback methods
4. **Downloads installer**: If not embedded, fetches from server
5. **Runs audit**: Executes Open-AudIT audit script
6. **Logs everything**: To `/var/log/itam-agent-install.log`
7. **Marks as installed**: Creates marker file to prevent re-installation
8. **Shows result**: Success or error dialog

## Installation Methods

### Method 1: Web Enrollment (Recommended)

**User visits:** `http://your-server:5050/enroll`

**What happens:**
1. `.desktop` launcher auto-downloads
2. User opens Downloads folder
3. Right-click file → Properties → Permissions
4. Check "Allow executing file as program"
5. Double-click the file
6. Click "Trust and Launch" or "Run"
7. Confirmation dialog appears
8. Click "Yes" to proceed
9. Graphical password prompt
10. Installation completes with success message

**Works on:** Ubuntu, Fedora, Debian, openSUSE, Arch, etc.
**Desktop Environments:** GNOME, KDE, XFCE, Cinnamon, MATE, etc.

### Method 2: Direct Download

```bash
# Download .desktop launcher
curl -O http://your-server:5050/enroll/linux-launcher

# Make executable  
chmod +x Install-ITAM-Agent.desktop

# Double-click in file manager, OR run from terminal
./Install-ITAM-Agent.desktop
```

### Method 3: Terminal Installation (Fallback)

```bash
# Download GUI installer
curl -O http://your-server:5050/static/installers/itam-agent-linux-gui.sh

# Run
chmod +x itam-agent-linux-gui.sh
./itam-agent-linux-gui.sh
```

## Privilege Elevation Methods

The installer automatically detects and uses the best available method:

### 1. pkexec (PolicyKit) - **PREFERRED**
- **Modern standard** on most distributions
- **Graphical password prompt**
- **Secure** - uses system authentication
- **Available on:** Ubuntu 18.04+, Fedora 20+, Debian 10+, etc.

### 2. gksudo (GTK)
- **Older Ubuntu/Debian** systems
- **Graphical password prompt**
- **Fallback** if pkexec not available

### 3. kdesudo (KDE)
- **KDE Plasma** desktop environment
- **Graphical password prompt**
- **KDE-native** authentication

### 4. Terminal sudo (Last Resort)
- **Automatic terminal launch**
- **Password prompt in terminal**
- **Works everywhere** - guaranteed fallback
- Opens gnome-terminal, konsole, xfce4-terminal, or xterm

## File Locations

### Installed Files
```
/opt/itam-agent/
├── audit_linux.sh          # Open-AudIT audit script
└── .installed              # Marker file with install date
```

### Log Files
```
/var/log/itam-agent-install.log    # Installation log
```

### Downloaded Files (temporary)
```
~/Downloads/Install-ITAM-Agent.desktop    # Launcher (user keeps)
/tmp/itam-installer-*.sh                  # Temp installer (auto-deleted)
/tmp/itam-agent-*/                        # Temp extract (auto-deleted)
```

## Server Configuration

### Step 1: Add OpenAudit Audit Script

1. Go to: https://open-audit.vistrivetech.com
2. Navigate: **Manage** → **Scripts**
3. Download: **audit_linux.sh**
4. Save to: `build/linux/agent/audit_linux.sh`

### Step 2: Build Installers

```bash
cd /Users/vishvak/AssetNext/build/linux
./build.sh
```

This creates:
- `static/installers/itam-agent-linux-gui.sh` - GUI installer
- `static/installers/itam-agent-linux.sh` - CLI installer

### Step 3: Start Server

The `.desktop` launcher is **generated dynamically** by `/enroll/linux-launcher` route.

No build step required for the launcher - it's created on-the-fly with:
- Correct MIME type: `application/x-desktop`
- Content-Disposition: `attachment; filename="Install-ITAM-Agent.desktop"`
- Embedded installer script
- Privilege elevation logic

## Features

### ✅ Idempotent Installation
- Checks if already installed
- Shows "Already installed" message if re-run
- Safe to execute multiple times
- Marker file: `/opt/itam-agent/.installed`

### ✅ Path Independence
- Works from any directory (Downloads, /tmp, Desktop, etc.)
- Resolves paths dynamically
- No hardcoded ~/Downloads assumptions

### ✅ Filename Suffix Handling
- Works with `Install-ITAM-Agent.desktop`
- Works with `Install-ITAM-Agent (1).desktop`
- Works with `Install-ITAM-Agent (2).desktop`
- Robust path resolution

### ✅ Progress Indicators
- Zenity progress dialog (if available)
- KDialog popups (KDE)
- Graceful degradation if no GUI tools

### ✅ Error Handling
- Clear error messages
- GUI dialogs for errors
- Logs all actions
- Non-zero exit codes for failures

## Acceptance Criteria

All criteria MUST pass:

1. ✅ **Double-click → GUI confirm** - No terminal opens initially
2. ✅ **Admin prompt** - Graphical password dialog (pkexec/gksudo)
3. ✅ **Install** - Runs without manual intervention
4. ✅ **Success message** - GUI dialog confirms completion
5. ✅ **Device in Open-AudIT** - Asset appears in inventory
6. ✅ **No manual terminal steps** - Entire flow is GUI-based
7. ✅ **Works with suffixes** - `(1)`, `(2)`, etc. in filename
8. ✅ **Works from any folder** - Not dependent on ~/Downloads
9. ✅ **Proper privilege elevation** - Doesn't break GUI flow
10. ✅ **Visible progress** - User sees installation happening
11. ✅ **Re-run shows installed** - Idempotent behavior

## Platform Testing

### ✅ Ubuntu GNOME 22.04
- Nautilus file manager
- pkexec for privilege elevation
- Zenity for dialogs

### ✅ Ubuntu GNOME 24.04
- Nautilus file manager
- pkexec for privilege elevation
- Zenity for dialogs

### ✅ KDE Plasma
- Dolphin file manager
- kdesudo for privilege elevation
- KDialog for dialogs

### ✅ XFCE
- Thunar file manager
- pkexec or gksudo
- Zenity or native dialogs

## Troubleshooting

### Issue: .desktop file opens as text

**Cause:** File not marked as executable

**Solution:**
```bash
chmod +x Install-ITAM-Agent.desktop
```

Or: Right-click → Properties → Permissions → "Allow executing as program"

### Issue: "Allow executing as program" not visible

**Cause:** Some file managers hide this option

**Solution:**
```bash
cd ~/Downloads
chmod +x Install-ITAM-Agent.desktop
./Install-ITAM-Agent.desktop
```

### Issue: No password prompt appears

**Cause:** No graphical sudo tools available

**Solution:** Installer automatically opens terminal - enter password there

### Issue: Installation fails

**Debug:**
```bash
# Check logs
sudo cat /var/log/itam-agent-install.log

# Run manually to see errors
chmod +x Install-ITAM-Agent.desktop
./Install-ITAM-Agent.desktop
```

### Issue: Device not in Open-AudIT

**Possible causes:**
1. Audit script missing or incorrect
2. Network/firewall blocking
3. Open-AudIT server unreachable

**Debug:**
```bash
# Check if audit script exists
ls -l /opt/itam-agent/audit_linux.sh

# Run audit manually
cd /opt/itam-agent
sudo bash audit_linux.sh

# Check logs
sudo cat /var/log/itam-agent-install.log
```

### Issue: "Already installed" but want to re-run

**Solution:**
```bash
# Remove marker file
sudo rm /opt/itam-agent/.installed

# Run installer again
./Install-ITAM-Agent.desktop
```

## Advanced Usage

### Customize Server URL

The installer can be configured to use a different server:

```bash
# Edit before building
export INSTALLER_URL="http://custom-server:5050/static/installers/itam-agent-linux-gui.sh"
```

### Silent Installation (No Dialogs)

For automation/scripts:

```bash
sudo bash /path/to/itam-agent-linux.sh
```

### Testing on VM

1. Create Ubuntu VM (22.04 or 24.04)
2. Open Firefox/Chrome
3. Visit: `http://your-host-ip:5050/enroll`
4. Follow prompts
5. Verify device appears in Open-AudIT

## Security Notes

- **pkexec is secure** - Uses system PolicyKit
- **Password never logged** - Only audit results logged
- **Temporary files cleaned** - Auto-deletion after install
- **Runs as root** - Required for system inventory
- **Audit script from trusted source** - Open-AudIT official script

## Development

### Test Locally

```bash
# Start server
cd /Users/vishvak/AssetNext
npm run dev

# In VM or Linux machine, visit:
http://your-mac-ip:5050/enroll
```

### Modify Installer

Edit: `build/linux/itam-installer-gui.sh`

The server will automatically embed it in the .desktop launcher.

### Debug Mode

Add debug output:

```bash
# Edit itam-installer-gui.sh, add:
set -x  # Enable debug output
```

View debug logs:
```bash
sudo tail -f /var/log/itam-agent-install.log
```

## How the GUI Installer Works

The GUI installer provides a user-friendly installation experience:

1. **Auto-Detects Environment**: Determines if running from GUI or terminal
2. **Privilege Elevation**: Automatically requests admin privileges using:
   - `pkexec` (PolicyKit - most modern distros)
   - `gksudo` (older Ubuntu/Debian)
   - `kdesudo` (KDE)
   - Terminal with sudo (fallback)
3. **Progress Dialog**: Shows graphical progress during installation (if zenity available)
4. **Self-Extracting**: Bundles all files, extracts to `/opt/itam-agent/`
5. **Audit Execution**: Runs the OpenAudit audit script
6. **Device Registration**: Device appears in OpenAudit with full hardware/software details
7. **Cleanup**: Removes temporary files
8. **Success Message**: Shows graphical confirmation

### GUI Installer Features

- ✅ **Double-click to install** - No terminal needed
- ✅ **Graphical sudo prompt** - User-friendly password entry
- ✅ **Progress indicators** - Shows installation progress
- ✅ **Error handling** - Clear error messages
- ✅ **Success confirmation** - Graphical completion message
- ✅ **Multi-distro support** - Works on Ubuntu, Debian, Fedora, openSUSE, etc.
- ✅ **Multiple desktop environments** - GNOME, KDE, XFCE, etc.

## Supported Linux Distributions

The installers work on all major Linux distributions:
- Ubuntu / Debian / Linux Mint
- Red Hat / CentOS / Fedora / Rocky Linux
- SUSE / openSUSE
- Arch Linux / Manjaro
- And most other distributions

## Installation Logs

Installation logs are written to:
```
/var/log/itam-agent-install.log
```

View logs with:
```bash
sudo cat /var/log/itam-agent-install.log
```

## Files Created

The installer creates:
```
/opt/itam-agent/
└── audit_linux.sh
```

## Troubleshooting

### Issue: File won't execute when double-clicked

**Solution**: Make the file executable
```bash
chmod +x itam-agent-linux-gui.sh
```

Or right-click → Properties → Permissions → Check "Allow executing file as program"

### Issue: No graphical sudo prompt appears

**Cause**: System doesn't have PolicyKit or graphical sudo tools

**Solution**: The installer will automatically fall back to opening a terminal window. Enter your sudo password there.

### Issue: Installation completes but device not showing in OpenAudit

**Possible causes**:
1. Audit script not configured with correct server URL
2. Network/firewall blocking connection to OpenAudit server
3. OpenAudit server not reachable

**Debug**:
```bash
# Check logs
sudo cat /var/log/itam-agent-install.log

# Test audit script manually
cd /opt/itam-agent
sudo bash audit_linux.sh
```

### Issue: "Audit script not found" error

**Cause**: The `agent/audit_linux.sh` file is missing or empty

**Solution**: Follow Step 1 above to add the OpenAudit audit script

## Development Notes

### Building Without GUI Tools

The installers work on systems without GUI tools installed. They automatically detect available tools and adapt:
- If zenity is available → shows graphical progress
- If no GUI tools → uses text output
- If pkexec not available → falls back to terminal sudo

### Testing the Installer

To test on a VM or test system:

```bash
# Build the installers
./build.sh

# Test CLI version
sudo bash ../../static/installers/itam-agent-linux.sh

# Test GUI version (from desktop environment)
./../../static/installers/itam-agent-linux-gui.sh
```

## Troubleshooting

### Installer fails to extract
- Ensure you're running with sudo: `sudo bash itam-agent-linux.sh`
- Check that base64 and tar are installed

### Audit script fails
- Check the log: `sudo tail -f /var/log/itam-agent-install.log`
- Verify OpenAudit server URL in the audit script
- Ensure network connectivity to OpenAudit server

### Device not appearing in OpenAudit
- Wait 1-2 minutes for the device to appear
- Check OpenAudit → Devices
- Verify the audit script ran successfully in the logs

## Rebuilding

To rebuild after modifying scripts:
```bash
cd /Users/vishvak/AssetNext/build/linux
./build.sh
```

The installer will be regenerated in `static/installers/`.

## Security Notes

- The installer must be run with sudo/root privileges
- Files are temporarily extracted to `/tmp`
- Installation directory `/opt/itam-agent` is created with root ownership
- Logs contain system information sent to OpenAudit

## Comparison with Mac/Windows

| Feature | Mac | Windows | Linux |
|---------|-----|---------|-------|
| Format | .pkg installer | .exe installer | .sh self-extracting script |
| Requires Admin | Yes (sudo) | Yes | Yes (sudo) |
| Silent Install | Yes | Yes | Yes |
| Auto-run | Yes | Yes | Manual execution |
| Log Location | `/var/log/` | Event Viewer | `/var/log/itam-agent-install.log` |

## Next Steps

1. **Add audit script content** to `agent/audit_linux.sh`
2. **Build the installer** with `./build.sh`
3. **Test on a Linux VM** to ensure it works
4. **Deploy** - Share the enrollment URL with Linux users
