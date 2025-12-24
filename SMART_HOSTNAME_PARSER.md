# Smart Hostname Parser - Implementation Guide

## Overview

The Smart Hostname Parser is an intelligent pattern-matching system that extracts vendor, device type, and friendly names from reverse DNS hostnames. This solves the problem of devices showing generic DNS names like "local.airtelfiber.com" instead of user-friendly names like "Airtel Fiber Router".

## Problem Solved

**Before:**
- Device shows up as "local.airtelfiber.com" (reverse DNS hostname)
- Hostname column also shows "local.airtelfiber.com"
- No manufacturer or device type information
- Confusing for users

**After:**
- Device shows up as "Airtel Fiber Router" (friendly name)
- Hostname normalized to "Airtel-Router"
- Manufacturer: "Airtel"
- Device Type: "Router"
- Clear categorization even without SNMP

## How It Works

### 1. **Parser Function** (`parse_smart_hostname`)

Located in `discovery-scanner/macos/itam-discovery.sh` (lines ~563-831)

The parser analyzes hostname patterns and extracts:
- **Manufacturer**: Airtel, Jio, TP-Link, D-Link, Netgear, etc.
- **Device Type**: router, access-point, switch, printer, nas, camera, etc.
- **Device Name**: Friendly display name (e.g., "Airtel Fiber Router")
- **Confidence**: High (vendor-specific) or Medium (generic patterns)

### 2. **Integration Points**

#### A. Smart Hostname Parsing (Line ~1310)
```bash
# After DNS lookup, before enrichment
if hostname_parsed=$(parse_smart_hostname "$hostname"); then
    IFS='|' read -r hostname_manufacturer hostname_device_type hostname_device_name hostname_confidence
    # Store parsed data for later use
fi
```

#### B. Fallback Logic (Line ~1405)
```bash
# After enrichment, fill in gaps with parsed data
if [ -z "$deviceType" ] && [ -n "$hostname_device_type" ]; then
    deviceType="$hostname_device_type"
fi

if [ -z "$deviceName" ] && [ -n "$hostname_device_name" ]; then
    deviceName="$hostname_device_name"
fi
```

#### C. Hostname Cleanup (Line ~1447)
```bash
# Clean reverse DNS names using parsed data
if [[ "$hostname" =~ \.com$ ]] || [[ "$hostname" =~ \.local$ ]]; then
    # Use hostname_device_name to generate clean hostname
    hostname=$(echo "$hostname_device_name" | sed 's/ \+/-/g')
fi
```

## Supported Patterns

### ISP Routers (High Confidence)
| Pattern | Manufacturer | Device Type | Device Name |
|---------|--------------|-------------|-------------|
| `airtelfiber` | Airtel | router | Airtel Fiber Router |
| `jiofiber`, `jio` | Jio | router | Jio Fiber Router |
| `bsnl` | BSNL | router | BSNL Router |
| `actfiber`, `actcorp` | ACT Fibernet | router | ACT Fiber Router |
| `hathway` | Hathway | router | Hathway Router |
| `tikona` | Tikona | router | Tikona Router |
| `spectra` | Spectranet | router | Spectranet Router |

### Consumer Router Brands (High Confidence)
| Pattern | Manufacturer | Device Type | Device Name |
|---------|--------------|-------------|-------------|
| `tplink`, `tp-link` | TP-Link | router/ap/switch* | TP-Link Router |
| `dlink`, `d-link` | D-Link | router/ap/camera* | D-Link Router |
| `netgear` | Netgear | router/nas* | Netgear Router |
| `linksys` | Linksys | router | Linksys Router |
| `asus` | ASUS | router/ap* | ASUS Router |
| `ubiquiti`, `unifi` | Ubiquiti | router/ap/switch* | Ubiquiti Router |
| `cisco` | Cisco | router/switch/firewall* | Cisco Router |

*Device type varies based on hostname keywords (ap, switch, extender, etc.)

### NAS/Storage Devices (High Confidence)
| Pattern | Manufacturer | Device Type | Device Name |
|---------|--------------|-------------|-------------|
| `synology` | Synology | nas | Synology NAS |
| `qnap` | QNAP | nas | QNAP NAS |

### Printer Brands (High Confidence)
| Pattern | Manufacturer | Device Type | Device Name |
|---------|--------------|-------------|-------------|
| `hp`, `hewlett`, `packard` | HP | printer | HP Printer |
| `canon` | Canon | printer | Canon Printer |
| `epson` | Epson | printer | Epson Printer |
| `brother` | Brother | printer | Brother Printer |

### Generic Device Types (Medium Confidence)
| Pattern | Device Type | Device Name |
|---------|-------------|-------------|
| `router` | router | Network Router |
| `switch`, `sw-` | switch | Network Switch |
| `ap-`, `access.*point` | access-point | Access Point |
| `gateway` | gateway | Network Gateway |
| `firewall` | firewall | Firewall |
| `nas`, `storage` | nas | Network Storage |
| `print`, `printer` | printer | Network Printer |
| `camera` | camera | IP Camera |

## Test Results

All test cases pass successfully:

```bash
./test-hostname-parser.sh
```

**Sample Output:**
```
Testing: local.airtelfiber.com
  ✓ Parsed successfully
    Manufacturer: Airtel
    Device Type:  router
    Device Name:  Airtel Fiber Router
    Confidence:   high
  ✓ PASS - Results match expectations

Testing: tplinkwifi.net
  ✓ Parsed successfully
    Manufacturer: TP-Link
    Device Type:  router
    Device Name:  TP-Link Router
    Confidence:   high
  ✓ PASS - Results match expectations
```

## Frontend Display

The frontend has been updated to properly display the parsed data:

### Discovery Modal
**File:** `client/src/pages/assets.tsx` (line ~2387)

```tsx
<h4 className="font-semibold">
  {device.deviceName || device.hostname || device.sysName || device.ipAddress || 'Unknown Device'}
</h4>

{/* Show hostname separately if different from deviceName */}
{device.hostname && device.hostname !== device.deviceName && (
  <div>
    <span className="font-medium">Hostname:</span> {device.hostname}
  </div>
)}
```

**Result:**
- Title: "Airtel Fiber Router" (from deviceName)
- Hostname: "Airtel-Router" (normalized)

### Asset Table
The hostname column shows the normalized hostname from `specifications.hostname`

## Debug Mode

Enable detailed logging to see the parser in action:

```bash
export DEBUG=1
export DISCOVERY_DEBUG=1
# Then run discovery
```

**Debug Output:**
```
[Hostname Parse] Success!
  Hostname: local.airtelfiber.com
  Manufacturer: Airtel
  Device Type: router
  Device Name: Airtel Fiber Router
  Confidence: high

[Fallback] Using hostname-parsed deviceType: router
[Fallback] Using hostname-parsed deviceName: Airtel Fiber Router
[Hostname] Cleaned: 'local.airtelfiber.com' → 'Airtel-Router'
```

## Adding New Patterns

To add support for new vendors or patterns:

1. **Edit the scanner script:**
   ```bash
   nano discovery-scanner/macos/itam-discovery.sh
   ```

2. **Add pattern in `parse_smart_hostname` function** (around line 600):
   ```bash
   elif [[ "$hostname_lower" =~ newvendor ]]; then
       manufacturer="NewVendor"
       device_type="router"
       device_name="NewVendor Router"
       confidence="high"
   ```

3. **Test the new pattern:**
   ```bash
   # Add test case to test-hostname-parser.sh
   test_hostname "newvendor.local" "NewVendor" "router" "NewVendor Router"
   ./test-hostname-parser.sh
   ```

## Data Flow Summary

```
┌─────────────────────────────────────────────────────────────┐
│ 1. DNS LOOKUP                                                │
│    Reverse DNS → "local.airtelfiber.com"                     │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. SMART HOSTNAME PARSING                                    │
│    parse_smart_hostname("local.airtelfiber.com")             │
│    → manufacturer: "Airtel"                                  │
│    → device_type: "router"                                   │
│    → device_name: "Airtel Fiber Router"                      │
│    → confidence: "high"                                      │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. ENRICHMENT (SNMP/HTTP/IPP)                                │
│    Try to get additional details                             │
│    If SNMP disabled → No manufacturer/model                  │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. FALLBACK LOGIC                                            │
│    If enrichment failed, use hostname-parsed data:           │
│    deviceType = "router"                                     │
│    deviceName = "Airtel Fiber Router"                        │
│    manufacturer = "Airtel" (already set earlier)             │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. HOSTNAME CLEANUP                                          │
│    "local.airtelfiber.com" → "Airtel-Router"                 │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. BACKEND STORAGE                                           │
│    name: "Airtel Fiber Router"                               │
│    category: "Router"                                        │
│    manufacturer: "Airtel"                                    │
│    specifications.hostname: "Airtel-Router"                  │
│    specifications.deviceName: "Airtel Fiber Router"          │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. FRONTEND DISPLAY                                          │
│    Discovery Modal: "Airtel Fiber Router"                    │
│    Asset List: "Airtel Fiber Router" | "Router" | "Airtel-Router" │
└─────────────────────────────────────────────────────────────┘
```

## Benefits

1. **Works without SNMP**: Extracts useful information even when SNMP is disabled
2. **Instant Recognition**: ISP and popular brands are recognized immediately
3. **Proper Categorization**: Devices are correctly categorized (router, printer, etc.)
4. **User-Friendly Names**: Shows "Airtel Fiber Router" instead of "local.airtelfiber.com"
5. **Normalized Hostnames**: Cleans up technical DNS names to readable format
6. **Extensible**: Easy to add new patterns for additional vendors

## Testing Instructions

1. **Delete old data** (if exists):
   ```sql
   DELETE FROM assets WHERE specifications->>'ipAddress' = '192.168.1.1';
   DELETE FROM discovered_devices WHERE ip_address = '192.168.1.1';
   ```

2. **Run new discovery scan** with your Airtel/Jio router

3. **Verify results**:
   - Discovery modal shows: "Airtel Fiber Router" (not "local.airtelfiber.com")
   - Hostname field shows: "Airtel-Router"
   - Import the device
   - Asset list shows proper name and category

4. **Enable debug mode** to see parser output:
   ```bash
   DEBUG=1 DISCOVERY_DEBUG=1 ./discovery-scanner/macos/itam-discovery.sh
   ```

## Conclusion

The Smart Hostname Parser transforms unintelligible reverse DNS names into meaningful, user-friendly device information. It provides intelligent fallback when SNMP is unavailable, making network discovery more robust and user-friendly.
