import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Network, 
  Wifi, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Download, 
  Activity,
  Laptop,
  Smartphone,
  Monitor as MonitorIcon
} from "lucide-react";

interface WifiDevice {
  id: number;
  tenantId: string;
  macAddress: string;
  ipAddress: string;
  hostname: string | null;
  manufacturer: string | null;
  assetId: string | null;
  assetName: string | null;
  isAuthorized: boolean;
  firstSeen: string;
  lastSeen: string;
  isActive: boolean;
  connectionDuration: number;
  deviceType: string | null;
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

interface Alert {
  id: number;
  tenantId: string;
  macAddress: string;
  ipAddress: string;
  hostname: string | null;
  manufacturer: string | null;
  detectedAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  status: string;
  notes: string | null;
  deviceInfo: any;
  createdAt: string;
  updatedAt: string;
}

export default function NetworkMonitoring() {
  const { user } = useAuth();
  const [showSetup, setShowSetup] = useState(true);
  const [devices, setDevices] = useState<WifiDevice[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState<string>("");

  const fetchDevices = async () => {
    try {
      const response = await fetch("/api/network/presence/live", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices || []);
        setLoading(false);
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await fetch("/api/network/alerts", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error("Error fetching alerts:", error);
    }
  };

  const generateApiKey = async () => {
    try {
      const response = await fetch("/api/network/agent/generate-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ agentName: "Office Agent" }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setApiKey(data.apiKey);
      }
    } catch (error) {
      console.error("Error generating API key:", error);
    }
  };

  const acknowledgeAlert = async (alertId: number) => {
    try {
      const response = await fetch(`/api/network/alerts/\${alertId}/acknowledge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ notes: "Acknowledged from dashboard" }),
      });
      
      if (response.ok) {
        fetchAlerts();
      }
    } catch (error) {
      console.error("Error acknowledging alert:", error);
    }
  };

  useEffect(() => {
    if (!showSetup) {
      fetchDevices();
      fetchAlerts();

      const eventSource = new EventSource("/api/network/presence/stream", {
        withCredentials: true,
      });

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "update") {
          setDevices(data.devices || []);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
      };

      return () => {
        eventSource.close();
      };
    }
  }, [showSetup]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `\${hours}h \${minutes}m`;
    return `\${minutes}m`;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (showSetup) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Network className="h-8 w-8" />
              Network Monitoring
            </h1>
            <p className="text-muted-foreground">Real-time Wi-Fi presence tracking</p>
          </div>
        </div>

        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>Setup Network Monitoring Agent</CardTitle>
            <CardDescription>
              Install the monitoring agent on a computer connected to your office network
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Step 1: Generate API Key</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Generate a unique API key for your monitoring agent
                </p>
                {!apiKey ? (
                  <Button onClick={generateApiKey}>
                    Generate API Key
                  </Button>
                ) : (
                  <div className="p-3 bg-muted rounded-md font-mono text-sm break-all">
                    {apiKey}
                  </div>
                )}
              </div>

              {apiKey && (
                <>
                  <div>
                    <h3 className="font-semibold mb-2">Step 2: Download Agent</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Choose your operating system and download the monitoring agent
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <Button variant="outline" className="flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        macOS
                      </Button>
                      <Button variant="outline" className="flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        Windows
                      </Button>
                      <Button variant="outline" className="flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        Linux
                      </Button>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Step 3: Configure & Run</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Extract the agent, set environment variables, and run with sudo
                    </p>
                    <div className="p-3 bg-muted rounded-md font-mono text-sm space-y-1">
                      <div>export API_URL="{window.location.origin}"</div>
                      <div>export API_KEY="{apiKey}"</div>
                      <div>sudo ./network-monitor-macos.sh</div>
                    </div>
                  </div>

                  <div className="pt-4">
                    <Button 
                      onClick={() => setShowSetup(false)}
                      className="w-full"
                    >
                      Continue to Dashboard
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingAlerts = alerts.filter(a => a.status === "pending");
  const authorizedDevices = devices.filter(d => d.isAuthorized);
  const unauthorizedDevices = devices.filter(d => !d.isAuthorized);

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Network className="h-8 w-8" />
            Network Monitoring
          </h1>
          <p className="text-muted-foreground">Real-time Wi-Fi presence tracking</p>
        </div>
        <Button variant="outline" onClick={() => setShowSetup(true)}>
          <Download className="h-4 w-4 mr-2" />
          Setup Agent
        </Button>
      </div>

      {pendingAlerts.length > 0 && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unauthorized Devices Detected</AlertTitle>
          <AlertDescription>
            {pendingAlerts.length} unauthorized device{pendingAlerts.length > 1 ? 's' : ''} detected on your network
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{devices.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <Activity className="inline h-3 w-3 mr-1" />
              Active connections
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Authorized</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{authorizedDevices.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <CheckCircle className="inline h-3 w-3 mr-1" />
              In inventory
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Unauthorized</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{unauthorizedDevices.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <XCircle className="inline h-3 w-3 mr-1" />
              Not in inventory
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connected Devices</CardTitle>
          <CardDescription>
            Real-time list of devices connected to your office Wi-Fi
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading devices...
            </div>
          ) : devices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No devices detected. Make sure the monitoring agent is running.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>MAC Address</TableHead>
                  <TableHead>Manufacturer</TableHead>
                  <TableHead>Connected</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell>
                      {device.isAuthorized ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Authorized
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Unauthorized
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Laptop className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">
                            {device.assetName || device.hostname || "Unknown Device"}
                          </div>
                          {device.assetName && device.hostname && (
                            <div className="text-xs text-muted-foreground">
                              {device.hostname}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {device.ipAddress}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {device.macAddress}
                    </TableCell>
                    <TableCell>{device.manufacturer || "Unknown"}</TableCell>
                    <TableCell className="text-sm">
                      {formatTimestamp(device.firstSeen)}
                    </TableCell>
                    <TableCell>
                      {formatDuration(device.connectionDuration)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {pendingAlerts.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Unauthorized Device Alerts</CardTitle>
            <CardDescription>
              Devices detected that are not in your asset inventory
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>MAC Address</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Hostname</TableHead>
                  <TableHead>Manufacturer</TableHead>
                  <TableHead>Detected At</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingAlerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell className="font-mono text-sm">
                      {alert.macAddress}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {alert.ipAddress}
                    </TableCell>
                    <TableCell>{alert.hostname || "Unknown"}</TableCell>
                    <TableCell>{alert.manufacturer || "Unknown"}</TableCell>
                    <TableCell className="text-sm">
                      {formatTimestamp(alert.detectedAt)}
                    </TableCell>
                    <TableCell>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => acknowledgeAlert(alert.id)}
                      >
                        Acknowledge
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
