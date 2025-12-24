/**
 * Device Enrichment Module
 * 
 * Multi-protocol network device discovery and enrichment
 * Supports: SNMP, IPP, mDNS/Bonjour, SSDP/UPnP, HTTP, ONVIF, MAC OUI
 * 
 * Priority: SNMP → IPP → mDNS → SSDP → HTTP → ONVIF → OUI
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as net from 'net';
import * as dgram from 'dgram';
import axios from 'axios';

const execAsync = promisify(exec);

export interface EnrichedDevice {
  ipAddress: string;
  macAddress?: string;
  hostname?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  deviceType?: string;
  protocols: string[];
  confidence: number;
  openPorts?: number[];
  evidence: Record<string, any>;
}

/**
 * Main enrichment function - tries all protocols in priority order
 */
export async function enrichDevice(ipAddress: string, macAddress?: string): Promise<EnrichedDevice> {
  const device: EnrichedDevice = {
    ipAddress,
    macAddress,
    protocols: [],
    confidence: 0,
    evidence: {},
  };

  console.log(`[Enrichment] Starting enrichment for ${ipAddress}`);

  // Try each protocol in priority order
  await trySnmp(device);
  await tryIpp(device);
  await tryMdns(device);
  await trySsdp(device);
  await tryHttp(device);
  await tryOnvif(device);
  
  // OUI lookup from MAC if available
  if (device.macAddress && !device.manufacturer) {
    await tryOuiLookup(device);
  }

  // Calculate confidence score
  device.confidence = calculateConfidence(device);

  console.log(`[Enrichment] Completed for ${ipAddress}, confidence: ${device.confidence}`);
  return device;
}

/**
 * SNMP Discovery (Priority 1)
 */
async function trySnmp(device: EnrichedDevice): Promise<void> {
  try {
    const communities = ['public', 'private', 'snmp', 'admin', 'itam_public'];
    
    for (const community of communities) {
      try {
        // Try sysDescr first to check if SNMP is available
        const { stdout: sysDescr } = await execAsync(
          `snmpget -v2c -c ${community} -t 2 -r 1 ${device.ipAddress} 1.3.6.1.2.1.1.1.0 2>/dev/null`,
          { timeout: 3000 }
        );

        if (sysDescr && sysDescr.trim()) {
          device.protocols.push('SNMP');
          device.evidence.snmp = { community, sysDescr: sysDescr.trim() };

          // Get additional SNMP data
          const queries = [
            { oid: '1.3.6.1.2.1.1.5.0', field: 'hostname', key: 'sysName' },
            { oid: '1.3.6.1.2.1.1.2.0', field: 'sysObjectID', key: 'sysObjectID' },
            { oid: '1.3.6.1.2.1.47.1.1.1.1.11.1', field: 'serialNumber', key: 'serial' },
            { oid: '1.3.6.1.2.1.47.1.1.1.1.12.1', field: 'manufacturer', key: 'vendor' },
            { oid: '1.3.6.1.2.1.47.1.1.1.1.13.1', field: 'model', key: 'model' },
          ];

          for (const query of queries) {
            try {
              const { stdout } = await execAsync(
                `snmpget -v2c -c ${community} -t 2 -r 1 ${device.ipAddress} ${query.oid} 2>/dev/null`,
                { timeout: 3000 }
              );
              const value = extractSnmpValue(stdout);
              if (value) {
                (device as any)[query.field] = value;
                device.evidence.snmp[query.key] = value;
              }
            } catch (err) {
              // Skip failed OID
            }
          }

          // Infer device type from sysObjectID or sysDescr
          if (device.evidence.snmp.sysObjectID) {
            device.deviceType = inferDeviceTypeFromSnmp(
              device.evidence.snmp.sysObjectID,
              device.evidence.snmp.sysDescr
            );
          }

          console.log(`[SNMP] Success for ${device.ipAddress} with community: ${community}`);
          break; // Successfully got SNMP data
        }
      } catch (err) {
        // Try next community
        continue;
      }
    }
  } catch (error) {
    console.log(`[SNMP] Failed for ${device.ipAddress}`);
  }
}

/**
 * IPP (Internet Printing Protocol) Discovery (Priority 2)
 */
async function tryIpp(device: EnrichedDevice): Promise<void> {
  try {
    // Check if port 631 is open
    const isOpen = await checkPort(device.ipAddress, 631, 2000);
    if (!isOpen) return;

    // IPP Get-Printer-Attributes request
    const charsetBuf = Buffer.from('attributes-charset');
    const utf8Buf = Buffer.from('utf-8');
    const langBuf = Buffer.from('attributes-natural-language');
    const enUsBuf = Buffer.from('en-us');
    const printerUriBuf = Buffer.from('printer-uri');
    const uriValueBuf = Buffer.from(`ipp://${device.ipAddress}:631/ipp/print`);
    
    const ippRequest = Buffer.concat([
      Buffer.from([
        0x01, 0x01, // IPP version 1.1
        0x00, 0x0b, // Get-Printer-Attributes operation
        0x00, 0x00, 0x00, 0x01, // request-id
        0x01, // begin attribute group
        0x47, 0x00, 0x12, // charset attribute
      ]),
      charsetBuf,
      Buffer.from([0x00, 0x05]),
      utf8Buf,
      Buffer.from([0x48, 0x00, 0x1b]), // natural language
      langBuf,
      Buffer.from([0x00, 0x05]),
      enUsBuf,
      Buffer.from([0x45, 0x00, 0x0b]), // printer-uri
      printerUriBuf,
      Buffer.from([0x00, 0x1c]),
      uriValueBuf,
      Buffer.from([0x03]), // end
    ]);

    const response = await sendTcpRequest(device.ipAddress, 631, ippRequest, 5000);
    
    if (response) {
      device.protocols.push('IPP');
      device.deviceType = 'printer';
      
      // Parse IPP response (simplified - full IPP parsing is complex)
      const responseStr = response.toString('utf8', 0, Math.min(response.length, 2000));
      
      // Extract make-and-model
      const makeModelMatch = responseStr.match(/make-and-model[^:]*:([^,\n]+)/i) ||
                            responseStr.match(/(HP|Canon|Epson|Brother|Xerox|Ricoh|Lexmark)[^\n]{0,50}/i);
      if (makeModelMatch) {
        const makeModel = makeModelMatch[1].trim();
        device.manufacturer = extractManufacturer(makeModel);
        device.model = makeModel;
        device.evidence.ipp = { makeModel };
      }

      // Extract serial if available
      const serialMatch = responseStr.match(/serial[- ]number[^:]*:([A-Z0-9]+)/i);
      if (serialMatch) {
        device.serialNumber = serialMatch[1].trim();
        device.evidence.ipp.serial = device.serialNumber;
      }

      console.log(`[IPP] Success for ${device.ipAddress}`);
    }
  } catch (error) {
    console.log(`[IPP] Failed for ${device.ipAddress}`);
  }
}

/**
 * mDNS/Bonjour Discovery (Priority 3)
 */
async function tryMdns(device: EnrichedDevice): Promise<void> {
  try {
    // Use dns-sd (macOS) or avahi-browse (Linux) to query mDNS
    let command = '';
    if (process.platform === 'darwin') {
      command = `dns-sd -Q ${device.ipAddress}.local -t 5 2>/dev/null || dns-sd -L -t 5 _ipp._tcp 2>/dev/null`;
    } else if (process.platform === 'linux') {
      command = `avahi-browse -t -r _ipp._tcp 2>/dev/null | grep ${device.ipAddress} -A 10 || avahi-browse -t -r _printer._tcp 2>/dev/null | grep ${device.ipAddress} -A 10`;
    }

    if (command) {
      const { stdout } = await execAsync(command, { timeout: 6000 });
      
      if (stdout) {
        device.protocols.push('mDNS');
        device.evidence.mdns = { raw: stdout.substring(0, 500) };

        // Extract printer info from mDNS TXT records
        const txtMatch = stdout.match(/txt="([^"]+)"/i) || stdout.match(/TXT:\s*(.+)/i);
        if (txtMatch) {
          const txt = txtMatch[1];
          
          // Parse TXT records (key=value format)
          const tyMatch = txt.match(/ty=([^,\n]+)/i);  // ty = Type/Model
          const productMatch = txt.match(/product=\(([^)]+)\)/i);
          const makeMatch = txt.match(/mfg=([^,\n]+)/i);  // mfg = Manufacturer
          
          if (tyMatch) device.model = tyMatch[1].trim();
          if (makeMatch) device.manufacturer = makeMatch[1].trim();
          if (productMatch) device.model = productMatch[1].trim();
          
          if (!device.deviceType) {
            device.deviceType = txt.match(/_ipp|_printer/i) ? 'printer' : 'unknown';
          }
        }

        // Extract hostname
        const hostnameMatch = stdout.match(/hostname\s*=\s*\[([^\]]+)\]/i) ||
                            stdout.match(/Name:\s*([^\n]+)/i);
        if (hostnameMatch && !device.hostname) {
          device.hostname = hostnameMatch[1].trim().replace(/\.local$/, '');
        }

        console.log(`[mDNS] Success for ${device.ipAddress}`);
      }
    }
  } catch (error) {
    console.log(`[mDNS] Failed for ${device.ipAddress}`);
  }
}

/**
 * SSDP/UPnP Discovery (Priority 4)
 */
async function trySsdp(device: EnrichedDevice): Promise<void> {
  return new Promise((resolve) => {
    try {
      const socket = dgram.createSocket('udp4');
      const ssdpMessage = Buffer.from(
        `M-SEARCH * HTTP/1.1\r\n` +
        `HOST: 239.255.255.250:1900\r\n` +
        `MAN: "ssdp:discover"\r\n` +
        `MX: 3\r\n` +
        `ST: ssdp:all\r\n` +
        `\r\n`
      );

      const timeout = setTimeout(() => {
        socket.close();
        resolve();
      }, 4000);

      socket.on('message', (msg) => {
        const response = msg.toString();
        
        // Check if response is from our target IP
        if (response.includes(device.ipAddress)) {
          device.protocols.push('SSDP');
          device.evidence.ssdp = { raw: response.substring(0, 500) };

          // Extract server info
          const serverMatch = response.match(/SERVER:\s*(.+)/i);
          if (serverMatch) {
            const server = serverMatch[1].trim();
            device.evidence.ssdp.server = server;
            
            // Infer device type
            if (server.match(/camera|nvr|ipc/i)) device.deviceType = 'camera';
            else if (server.match(/nas|storage/i)) device.deviceType = 'nas';
            else if (server.match(/router|gateway/i)) device.deviceType = 'router';
            
            // Extract manufacturer
            const mfgMatch = server.match(/(Synology|QNAP|Netgear|TP-Link|D-Link|Hikvision|Dahua)/i);
            if (mfgMatch) device.manufacturer = mfgMatch[1];
          }

          // Extract location URL for more details
          const locationMatch = response.match(/LOCATION:\s*(.+)/i);
          if (locationMatch) {
            device.evidence.ssdp.location = locationMatch[1].trim();
          }

          clearTimeout(timeout);
          socket.close();
          console.log(`[SSDP] Success for ${device.ipAddress}`);
          resolve();
        }
      });

      socket.on('error', () => {
        clearTimeout(timeout);
        socket.close();
        resolve();
      });

      // Send SSDP M-SEARCH to specific IP (unicast)
      socket.send(ssdpMessage, 1900, device.ipAddress, (err) => {
        if (err) {
          clearTimeout(timeout);
          socket.close();
          resolve();
        }
      });
    } catch (error) {
      console.log(`[SSDP] Failed for ${device.ipAddress}`);
      resolve();
    }
  });
}

/**
 * HTTP Banner Grabbing (Priority 5)
 */
async function tryHttp(device: EnrichedDevice): Promise<void> {
  const ports = [80, 443, 8080, 8443];
  
  for (const port of ports) {
    try {
      const protocol = port === 443 || port === 8443 ? 'https' : 'http';
      const url = `${protocol}://${device.ipAddress}:${port}`;
      
      const response = await axios.get(url, {
        timeout: 3000,
        validateStatus: () => true, // Accept any status
        maxRedirects: 0,
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
      });

      if (response) {
        device.protocols.push('HTTP');
        device.evidence.http = device.evidence.http || {};
        device.evidence.http[`port${port}`] = {
          status: response.status,
          headers: response.headers,
        };

        // Extract Server header
        const server = response.headers['server'];
        if (server) {
          device.evidence.http[`port${port}`].server = server;
          
          // Infer device type and manufacturer from server header
          if (server.match(/printer|cups|ipp/i)) device.deviceType = 'printer';
          else if (server.match(/camera|ipcam|dvr|nvr/i)) device.deviceType = 'camera';
          else if (server.match(/nas|storage/i)) device.deviceType = 'nas';
          else if (server.match(/router|gateway|switch/i)) device.deviceType = device.deviceType || 'network-device';
          
          const mfgMatch = server.match(/(HP|Canon|Epson|Brother|Cisco|Juniper|Aruba|Synology|QNAP|Hikvision|Dahua|Ubiquiti|TP-Link)/i);
          if (mfgMatch && !device.manufacturer) device.manufacturer = mfgMatch[1];
        }

        // Extract title from HTML
        if (response.data && typeof response.data === 'string') {
          const titleMatch = response.data.match(/<title>([^<]+)<\/title>/i);
          if (titleMatch) {
            const title = titleMatch[1].trim();
            device.evidence.http[`port${port}`].title = title;
            
            // Extract model from title
            if (!device.model && title) {
              const modelMatch = title.match(/([A-Z0-9]+-[A-Z0-9]+|[A-Z][0-9]{3,}[A-Z]?)/);
              if (modelMatch) device.model = modelMatch[1];
            }
          }
        }

        console.log(`[HTTP] Success for ${device.ipAddress}:${port}`);
        break; // Got HTTP data, no need to try other ports
      }
    } catch (error) {
      // Try next port
      continue;
    }
  }
}

/**
 * ONVIF Discovery for IP Cameras (Priority 6)
 */
async function tryOnvif(device: EnrichedDevice): Promise<void> {
  try {
    // ONVIF WS-Discovery probe
    const probeMessage = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing">
  <s:Header>
    <a:Action s:mustUnderstand="1">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</a:Action>
    <a:MessageID>uuid:${generateUuid()}</a:MessageID>
    <a:To s:mustUnderstand="1">urn:schemas-xmlsoap-org:ws:2005:04:discovery</a:To>
  </s:Header>
  <s:Body>
    <Probe xmlns="http://schemas.xmlsoap.org/ws/2005/04/discovery">
      <d:Types xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:dp0="http://www.onvif.org/ver10/network/wsdl">dp0:NetworkVideoTransmitter</d:Types>
    </Probe>
  </s:Body>
</s:Envelope>`;

    const socket = dgram.createSocket('udp4');
    const message = Buffer.from(probeMessage);
    
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        socket.close();
        resolve();
      }, 4000);

      socket.on('message', (msg) => {
        const response = msg.toString();
        
        if (response.includes(device.ipAddress) || response.includes('ProbeMatch')) {
          device.protocols.push('ONVIF');
          device.deviceType = 'camera';
          device.evidence.onvif = { raw: response.substring(0, 500) };

          // Extract manufacturer and model from ONVIF response
          const mfgMatch = response.match(/mfr=([^<\s]+)/i) || response.match(/(Hikvision|Dahua|Axis|Sony)/i);
          const modelMatch = response.match(/model=([^<\s]+)/i);
          
          if (mfgMatch) device.manufacturer = mfgMatch[1];
          if (modelMatch) device.model = modelMatch[1];

          clearTimeout(timeout);
          socket.close();
          console.log(`[ONVIF] Success for ${device.ipAddress}`);
          resolve();
        }
      });

      socket.on('error', () => {
        clearTimeout(timeout);
        socket.close();
        resolve();
      });

      socket.send(message, 3702, device.ipAddress, (err) => {
        if (err) {
          clearTimeout(timeout);
          socket.close();
          resolve();
        }
      });
    });
  } catch (error) {
    console.log(`[ONVIF] Failed for ${device.ipAddress}`);
  }
}

/**
 * MAC OUI Lookup (Priority 7 - Fallback)
 */
async function tryOuiLookup(device: EnrichedDevice): Promise<void> {
  try {
    if (!device.macAddress) return;

    // Extract OUI (first 3 octets)
    const oui = device.macAddress.replace(/[:-]/g, '').substring(0, 6).toUpperCase();
    
    // Try macvendors.com API (free, no key required)
    try {
      const response = await axios.get(`https://api.macvendors.com/${device.macAddress}`, {
        timeout: 3000,
      });
      
      if (response.data) {
        device.manufacturer = response.data.toString().trim();
        device.protocols.push('OUI');
        device.evidence.oui = { vendor: device.manufacturer, oui };
        console.log(`[OUI] Success for ${device.ipAddress}: ${device.manufacturer}`);
      }
    } catch (ouiError) {
      // API might be rate limited, use local OUI database subset
      const vendor = getVendorFromOuiLocal(oui);
      if (vendor) {
        device.manufacturer = vendor;
        device.protocols.push('OUI');
        device.evidence.oui = { vendor, oui };
      }
    }
  } catch (error) {
    console.log(`[OUI] Failed for ${device.ipAddress}`);
  }
}

/**
 * Helper: Extract value from SNMP output
 */
function extractSnmpValue(stdout: string): string | null {
  const matches = stdout.match(/STRING:\s*"?([^"\n]+)"?/) ||
                  stdout.match(/INTEGER:\s*(\d+)/) ||
                  stdout.match(/Hex-STRING:\s*([^\s]+)/) ||
                  stdout.match(/OID:\s*([^\s]+)/);
  return matches ? matches[1].trim() : null;
}

/**
 * Helper: Infer device type from SNMP data
 */
function inferDeviceTypeFromSnmp(sysObjectID: string, sysDescr: string): string {
  // Common OID prefixes
  if (sysObjectID.startsWith('1.3.6.1.4.1.11.')) return 'printer'; // HP
  if (sysObjectID.startsWith('1.3.6.1.4.1.9.')) return 'switch'; // Cisco
  if (sysObjectID.startsWith('1.3.6.1.4.1.2636.')) return 'router'; // Juniper
  if (sysObjectID.startsWith('1.3.6.1.4.1.43.')) return 'switch'; // 3Com
  
  // Infer from description
  if (sysDescr.match(/printer|laserjet|inkjet|photosmart/i)) return 'printer';
  if (sysDescr.match(/switch|catalyst/i)) return 'switch';
  if (sysDescr.match(/router|gateway|firewall/i)) return 'router';
  if (sysDescr.match(/access point|ap/i)) return 'access-point';
  if (sysDescr.match(/storage|nas/i)) return 'nas';
  
  return 'network-device';
}

/**
 * Helper: Extract manufacturer from model string
 */
function extractManufacturer(modelString: string): string {
  const manufacturers = [
    'HP', 'Canon', 'Epson', 'Brother', 'Xerox', 'Ricoh', 'Lexmark',
    'Cisco', 'Juniper', 'Aruba', 'Ubiquiti', 'TP-Link', 'D-Link',
    'Synology', 'QNAP', 'Buffalo', 'Netgear',
    'Hikvision', 'Dahua', 'Axis', 'Sony'
  ];
  
  for (const mfg of manufacturers) {
    if (modelString.match(new RegExp(mfg, 'i'))) {
      return mfg;
    }
  }
  
  return modelString.split(/[\s-]/)[0]; // First word as fallback
}

/**
 * Helper: Calculate confidence score
 */
function calculateConfidence(device: EnrichedDevice): number {
  let score = 0;
  
  // Each field contributes to confidence
  if (device.manufacturer) score += 0.2;
  if (device.model) score += 0.2;
  if (device.serialNumber) score += 0.15;
  if (device.hostname) score += 0.1;
  if (device.deviceType) score += 0.15;
  if (device.firmwareVersion) score += 0.1;
  if (device.protocols.length >= 2) score += 0.1;
  
  return Math.min(score, 1.0);
}

/**
 * Helper: Check if TCP port is open
 */
function checkPort(host: string, port: number, timeout: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeout);

    socket.connect(port, host, () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

/**
 * Helper: Send TCP request and get response
 */
function sendTcpRequest(host: string, port: number, data: Buffer, timeout: number): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let responseData = Buffer.alloc(0);
    
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(responseData.length > 0 ? responseData : null);
    }, timeout);

    socket.connect(port, host, () => {
      socket.write(data);
    });

    socket.on('data', (chunk) => {
      responseData = Buffer.concat([responseData, chunk]);
    });

    socket.on('end', () => {
      clearTimeout(timer);
      resolve(responseData);
    });

    socket.on('error', () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

/**
 * Helper: Generate UUID for ONVIF
 */
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Helper: Local OUI database subset (common vendors)
 */
function getVendorFromOuiLocal(oui: string): string | null {
  const ouiDb: Record<string, string> = {
    '000C29': 'VMware',
    '005056': 'VMware',
    '00155D': 'Microsoft',
    '001AA0': 'Dell',
    '0010E0': 'HP',
    '001B63': 'HP',
    '0025B3': 'HP',
    '00D0B7': 'Intel',
    '00E04C': 'Realtek',
    '001E67': 'Canon',
    '00176C': 'Brother',
    '001714': 'Epson',
    '008066': 'Xerox',
    'B827EB': 'Raspberry Pi',
    'DCA632': 'Raspberry Pi',
    '00248C': 'Cisco',
    '001F9E': 'Cisco',
    '68A86D': 'Cisco',
    '002219': 'Synology',
    '001132': 'QNAP',
    '742B62': 'Ubiquiti',
    'DC9FDB': 'Ubiquiti',
  };
  
  return ouiDb[oui] || null;
}
