import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { FloatingAIAssistant } from "@/components/ai/floating-ai-assistant";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { authenticatedRequest } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Download, CheckCircle, AlertCircle, Loader2, Network, Server, Router, Printer, RefreshCw, XCircle } from "lucide-react";

interface DiscoveredDevice {
  id: string;
  ipAddress: string;
  macAddress?: string;
  hostname?: string;
  sysName?: string;
  sysDescr?: string;
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  discoveryMethod: 'snmpv3' | 'snmpv2c' | 'port-fingerprint' | 'IPP' | 'mDNS' | 'SSDP' | 'HTTP' | 'ONVIF' | 'OUI';
  status: 'discovered' | 'partial' | 'failed';
  isDuplicate: boolean;
  duplicateAssetId?: string;
  portFingerprint?: string;
  openPorts?: number[];
  // Enrichment fields
  deviceType?: string;
  deviceName?: string;
  firmwareVersion?: string;
  confidence?: number;
  protocols?: string[];
  enrichmentStatus?: 'pending' | 'enriching' | 'complete' | 'failed';
  enrichedAt?: string;
}

interface DiscoveryJob {
  id: string;
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'expired';
  osType: string;
  totalHosts?: number;
  scannedHosts?: number;
  successfulHosts?: number;
  partialHosts?: number;
  unreachableHosts?: number;
  expiresAt: string;
}

export default function NetworkDiscoveryPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedOS, setSelectedOS] = useState<'macos' | 'windows' | 'linux' | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [currentJob, setCurrentJob] = useState<DiscoveryJob | null>(null);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [siteName, setSiteName] = useState("");
  const [tags, setTags] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);

  console.log('[Discovery] State:', { selectedOS, isDownloading, hasDownloaded, jobId });

  // Poll for results when job is active
  useEffect(() => {
    if (!jobId || !hasDownloaded) return;

    setIsPolling(true);
    const pollInterval = setInterval(async () => {
      try {
        console.log('[Discovery] Polling for results, jobId:', jobId);
        const response = await authenticatedRequest('GET', `/api/discovery/jobs/${jobId}`);
        const data: any = await response.json();
        console.log('[Discovery] Poll result:', data);
        
        if (data.job) {
          setCurrentJob(data.job);
        }
        
        if (data.devices && data.devices.length > 0) {
          console.log('[Discovery] Devices found:', data.devices.length);
          setDiscoveredDevices(data.devices);
          setIsPolling(false);
          clearInterval(pollInterval);
          
          // Auto-select non-duplicate devices
          const nonDuplicates = data.devices
            .filter((d: DiscoveredDevice) => !d.isDuplicate)
            .map((d: DiscoveredDevice) => d.id);
          setSelectedDevices(nonDuplicates);
          
          // Show review modal
          setShowReviewModal(true);
          toast({
            title: "Devices Discovered!",
            description: `Found ${data.devices.length} device(s) on your network`,
          });
        }
      } catch (error: any) {
        console.error('[Discovery] Polling error:', error);
      }
    }, 5000); // Poll every 5 seconds

    return () => {
      clearInterval(pollInterval);
      setIsPolling(false);
    };
  }, [jobId, hasDownloaded]);

  const downloadAgent = async (osType: 'macos' | 'windows' | 'linux') => {
    console.log('[Discovery] downloadAgent called for OS:', osType);
    setSelectedOS(osType);
    setIsDownloading(true);
    
    try {
      console.log('[Discovery] Creating discovery job...');
      const response = await authenticatedRequest('POST', '/api/discovery/jobs', {});
      console.log('[Discovery] Raw response:', response);
      
      const data: any = await response.json();
      console.log('[Discovery] Parsed data:', data);
      
      if (data.success) {
        const newJobId = data.job.jobId;
        console.log('[Discovery] Setting jobId to:', newJobId);
        setJobId(newJobId);
        setCurrentJob(data.job);
        
        // Persist jobId to sessionStorage
        sessionStorage.setItem('discoveryJobId', newJobId);
        console.log('[Discovery] Saved jobId to sessionStorage:', newJobId);
        
        // Update UI to show download button
        setHasDownloaded(true);
        setIsDownloading(false);
        
        toast({
          title: "Ready to Download!",
          description: `Click the download button to get the ${osType} scanner`,
        });
      } else {
        throw new Error(data.message || 'Failed to create discovery job');
      }
    } catch (error: any) {
      console.error('[Discovery] Download error:', error);
      toast({
        title: "Download failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
      setIsDownloading(false);
      setSelectedOS(null);
      setHasDownloaded(false);
    }
  };

  const handleImport = async () => {
    if (selectedDevices.length === 0) {
      toast({
        title: "No devices selected",
        description: "Please select at least one device to import",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    try {
      await authenticatedRequest('POST', '/api/discovery/import', {
        jobId: currentJob?.id,
        deviceIds: selectedDevices,
        siteName: siteName || null,
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
      });

      toast({
        title: "Devices imported successfully",
        description: `${selectedDevices.length} device(s) added to inventory`,
      });

      // Clear the saved jobId after successful import
      sessionStorage.removeItem('discoveryJobId');
      
      setShowReviewModal(false);
      setLocation('/assets');
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message || "Failed to import devices",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const triggerEnrichment = async () => {
    if (!jobId) return;
    
    const pendingCount = discoveredDevices.filter(d => d.enrichmentStatus === 'pending').length;
    if (pendingCount === 0) {
      toast({
        title: "No enrichment needed",
        description: "All devices are already enriched",
      });
      return;
    }

    setIsEnriching(true);
    try {
      const response = await authenticatedRequest('POST', `/api/discovery/enrich/${jobId}`);
      const data: any = await response.json();
      
      toast({
        title: "Enrichment started",
        description: `Processing ${pendingCount} device(s)...`,
      });

      // Refresh devices after a short delay
      setTimeout(async () => {
        const refreshResponse = await authenticatedRequest('GET', `/api/discovery/jobs/${jobId}`);
        const refreshData: any = await refreshResponse.json();
        if (refreshData.devices) {
          setDiscoveredDevices(refreshData.devices);
        }
        
        toast({
          title: "Enrichment completed",
          description: `${data.enrichedCount || 0} device(s) enriched successfully`,
        });
      }, 3000);

    } catch (error: any) {
      toast({
        title: "Enrichment failed",
        description: error.message || "Failed to enrich devices",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDirectDownload = async () => {
    if (!jobId || !selectedOS) return;
    
    console.log('[Discovery] Starting direct download via fetch...');
    toast({
      title: "Starting download...",
      description: "Please wait",
    });
    
    try {
      const response = await fetch(`/api/discovery/download/${jobId}/${selectedOS}`);
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ITAM-Discovery-${jobId}.${selectedOS === 'windows' ? 'bat' : selectedOS === 'macos' ? 'command' : 'sh'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      console.log('[Discovery] Download triggered successfully');
      toast({
        title: "Download Complete!",
        description: `Check your Downloads folder for the scanner`,
      });
    } catch (error: any) {
      console.error('[Discovery] Direct download error:', error);
      toast({
        title: "Download failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleDevice = (deviceId: string) => {
    setSelectedDevices(prev =>
      prev.includes(deviceId)
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  const selectAll = () => {
    const nonDuplicates = discoveredDevices
      .filter(d => !d.isDuplicate)
      .map(d => d.id);
    setSelectedDevices(nonDuplicates);
  };

  const getDeviceIcon = (device: DiscoveredDevice) => {
    const fingerprint = device.portFingerprint?.toLowerCase() || device.sysDescr?.toLowerCase() || '';
    
    if (fingerprint.includes('printer') || fingerprint.includes('jetdirect')) {
      return <Printer className="w-5 h-5" />;
    } else if (fingerprint.includes('router') || fingerprint.includes('switch')) {
      return <Router className="w-5 h-5" />;
    } else if (fingerprint.includes('server') || fingerprint.includes('linux') || fingerprint.includes('windows')) {
      return <Server className="w-5 h-5" />;
    }
    return <Network className="w-5 h-5" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'discovered':
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Complete</Badge>;
      case 'partial':
        return <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" />Partial</Badge>;
      default:
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
    }
  };

  const getEnrichmentBadge = (enrichmentStatus: string) => {
    switch (enrichmentStatus) {
      case 'complete':
        return <Badge variant="default" className="bg-blue-600"><CheckCircle className="w-3 h-3 mr-1" />Enriched</Badge>;
      case 'enriching':
        return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Enriching</Badge>;
      case 'pending':
        return <Badge variant="outline"><AlertCircle className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 md:ml-64 overflow-auto">
        <TopBar title="Network Discovery" description="Discover and add network devices like printers, routers, and switches to your inventory" />
        <div className="p-6">
          <div className="max-w-5xl mx-auto">
            <Card className="p-6">
              {!hasDownloaded ? (
                /* Step 1: OS Selection */
                <div className="text-center space-y-6">
                  <div>
                    <Network className="w-16 h-16 mx-auto mb-4 text-primary" />
                    <h2 className="text-2xl font-bold mb-2">Network Device Discovery</h2>
                    <p className="text-muted-foreground max-w-2xl mx-auto">
                      Discover and add network devices like printers, routers, switches, and other 
                      non-endpoint devices to your asset inventory using SNMP scanning.
                    </p>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800 text-left max-w-2xl mx-auto">
                    <h3 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">How it works:</h3>
                    <ol className="text-sm space-y-1 text-blue-800 dark:text-blue-200">
                      <li>1. Select your computer's operating system below</li>
                      <li>2. Download and run the discovery agent</li>
                      <li>3. The agent will scan your network for devices</li>
                      <li>4. Review discovered devices and select which ones to add</li>
                      <li>5. Selected devices will be automatically added to your inventory</li>
                    </ol>
                  </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-4">Select Your Operating System:</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                        {/* macOS Option */}
                        <Card className="p-6 hover:shadow-lg transition-all hover:border-primary">
                          <div className="text-center space-y-3">
                            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-gray-600 to-gray-800 rounded-2xl flex items-center justify-center">
                              <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                              </svg>
                            </div>
                            <div>
                              <h4 className="font-semibold text-lg">macOS</h4>
                              <p className="text-sm text-muted-foreground">For Mac computers</p>
                            </div>
                            <Button 
                              className="w-full" 
                              disabled={isDownloading}
                              onClick={() => downloadAgent('macos')}
                            >
                              {isDownloading && selectedOS === 'macos' ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Preparing...
                                </>
                              ) : (
                                <>
                                  <Download className="w-4 h-4 mr-2" />
                                  Download for macOS
                                </>
                              )}
                            </Button>
                          </div>
                        </Card>

                        {/* Windows Option */}
                        <Card className="p-6 hover:shadow-lg transition-all hover:border-primary">
                          <div className="text-center space-y-3">
                            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center">
                              <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3 5.45L10.94 4.3v6.56H3V5.45zm0 13.1l7.94 1.16v-6.55H3v5.39zM11.88 4L21 2.5v8.36h-9.12V4zm0 16.5L21 22V13.64h-9.12V20.5z"/>
                              </svg>
                            </div>
                            <div>
                              <h4 className="font-semibold text-lg">Windows</h4>
                              <p className="text-sm text-muted-foreground">For Windows PC</p>
                            </div>
                            <Button 
                              className="w-full" 
                              disabled={isDownloading}
                              onClick={() => downloadAgent('windows')}
                            >
                              {isDownloading && selectedOS === 'windows' ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Preparing...
                                </>
                              ) : (
                                <>
                                  <Download className="w-4 h-4 mr-2" />
                                  Download for Windows
                                </>
                              )}
                            </Button>
                          </div>
                        </Card>

                        {/* Linux Option */}
                        <Card className="p-6 hover:shadow-lg transition-all hover:border-primary">
                          <div className="text-center space-y-3">
                            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-orange-500 to-orange-700 rounded-2xl flex items-center justify-center">
                              <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12.5 0C11.58 0 10.86.72 10.86 1.61c0 .89.72 1.61 1.64 1.61s1.64-.72 1.64-1.61C14.14.72 13.42 0 12.5 0zM8.04 3.32c-.51 0-.92.41-.92.92 0 .51.41.92.92.92s.92-.41.92-.92c0-.51-.41-.92-.92-.92zm8.89 0c-.51 0-.92.41-.92.92 0 .51.41.92.92.92s.92-.41.92-.92c0-.51-.41-.92-.92-.92zM6.15 5.5c-.28 0-.55.23-.55.51 0 .28.27.51.55.51s.55-.23.55-.51c0-.28-.27-.51-.55-.51zm12.67 0c-.28 0-.55.23-.55.51 0 .28.27.51.55.51s.55-.23.55-.51c0-.28-.27-.51-.55-.51zM12.5 6.89c-3.82 0-7.12 2.75-7.81 6.51-.69 3.76 1.33 7.36 4.82 8.71.37.14.78-.03.92-.4.14-.37-.03-.78-.4-.92-2.87-1.11-4.53-4.08-3.98-7.17.55-3.09 3.28-5.35 6.45-5.35s5.9 2.26 6.45 5.35c.55 3.09-1.11 6.06-3.98 7.17-.37.14-.54.55-.4.92.14.37.55.54.92.4 3.49-1.35 5.51-4.95 4.82-8.71-.69-3.76-3.99-6.51-7.81-6.51zM8.73 11.18c-.46 0-.83.37-.83.83v3.32c0 .46.37.83.83.83s.83-.37.83-.83v-3.32c0-.46-.37-.83-.83-.83zm7.54 0c-.46 0-.83.37-.83.83v3.32c0 .46.37.83.83.83s.83-.37.83-.83v-3.32c0-.46-.37-.83-.83-.83z"/>
                              </svg>
                            </div>
                            <div>
                              <h4 className="font-semibold text-lg">Linux</h4>
                              <p className="text-sm text-muted-foreground">For Linux systems</p>
                            </div>
                            <Button 
                              className="w-full" 
                              disabled={isDownloading}
                              onClick={() => downloadAgent('linux')}
                            >
                              {isDownloading && selectedOS === 'linux' ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Preparing...
                                </>
                              ) : (
                                <>
                                  <Download className="w-4 h-4 mr-2" />
                                  Download for Linux
                                </>
                              )}
                            </Button>
                          </div>
                        </Card>
                      </div>
                    </div>
                  </div>
                ) : hasDownloaded ? (
                  /* Step 2: Waiting for scan results */
                  <div className="space-y-4">
                    <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                      <CheckCircle className="w-4 h-4" />
                      <AlertDescription>
                        <strong>Scanner Ready for Download!</strong>
                        <p className="mt-2 text-sm">
                          Click the button below to download the discovery agent for <strong>{selectedOS}</strong>.
                        </p>
                      </AlertDescription>
                    </Alert>

                    <Card className="p-6 bg-primary/5 border-2 border-primary">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold">Download Scanner</h3>
                          <p className="text-sm text-muted-foreground">Job ID: {jobId}</p>
                        </div>
                        <Download className="w-8 h-8 text-primary" />
                      </div>
                      
                      <div className="space-y-3">
                        <a
                          href={`/api/discovery/download/${jobId}/${selectedOS}`}
                          download={`ITAM-Discovery-${jobId}.${selectedOS === 'windows' ? 'bat' : selectedOS === 'macos' ? 'command' : 'sh'}`}
                          className="inline-block w-full"
                          onClick={(e) => {
                            console.log('[Discovery] Download link clicked');
                            toast({
                              title: "Download Started",
                              description: `Check your Downloads folder for the scanner file`,
                            });
                          }}
                        >
                          <Button className="w-full" size="lg">
                            <Download className="w-5 h-5 mr-2" />
                            Download {selectedOS === 'macos' ? 'macOS' : selectedOS === 'windows' ? 'Windows' : 'Linux'} Scanner
                          </Button>
                        </a>
                        
                        <p className="text-xs text-center text-muted-foreground">Or if the above doesn't work:</p>
                        
                        <Button 
                          onClick={handleDirectDownload}
                          variant="outline"
                          className="w-full"
                          size="lg"
                        >
                          <Download className="w-5 h-5 mr-2" />
                          Alternative Download Method
                        </Button>
                      </div>
                    </Card>

                    <Card className="p-6 bg-muted/50">
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                            <span className="text-lg font-bold text-primary">1</span>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold mb-1">Locate the downloaded file</h4>
                            <p className="text-sm text-muted-foreground">
                              Check your Downloads folder for: <code className="bg-background px-2 py-0.5 rounded text-xs">ITAM-Discovery-{jobId}.{selectedOS === 'windows' ? 'bat' : 'command'}</code>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                            <span className="text-lg font-bold text-primary">2</span>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold mb-1">Run the scanner</h4>
                            <p className="text-sm text-muted-foreground">
                              {selectedOS === 'macos' && "Double-click the .command file (you may need to right-click → Open on first run)"}
                              {selectedOS === 'windows' && "Right-click the .bat file and select 'Run as administrator'"}
                              {selectedOS === 'linux' && "Open terminal, navigate to Downloads, and run: sudo bash ITAM-Discovery-" + jobId + ".sh"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                            <span className="text-lg font-bold text-primary">3</span>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold mb-1">Wait for scan to complete</h4>
                            <p className="text-sm text-muted-foreground">
                              The scanner will find all network devices and automatically upload the results.
                              Discovered devices will appear here automatically.
                            </p>
                          </div>
                        </div>
                      </div>
                    </Card>

                    {isPolling && (
                      <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-3">
                          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                          <div className="flex-1">
                            <p className="font-medium text-blue-900 dark:text-blue-100">Waiting for scan results...</p>
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                              Job ID: {jobId} • Status: {currentJob?.status || 'pending'}
                            </p>
                          </div>
                        </div>
                        {(currentJob?.scannedHosts || 0) > 0 && (
                          <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                            <div className="text-center">
                              <p className="text-xl font-bold text-blue-900 dark:text-blue-100">{currentJob?.scannedHosts}</p>
                              <p className="text-xs text-blue-700 dark:text-blue-300">Scanned</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xl font-bold text-green-600">{currentJob?.successfulHosts}</p>
                              <p className="text-xs text-blue-700 dark:text-blue-300">Found</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xl font-bold text-yellow-600">{currentJob?.partialHosts}</p>
                              <p className="text-xs text-blue-700 dark:text-blue-300">Partial</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xl font-bold text-red-600">{currentJob?.unreachableHosts}</p>
                              <p className="text-xs text-blue-700 dark:text-blue-300">Failed</p>
                            </div>
                          </div>
                        )}
                      </Card>
                    )}

                    <div className="flex gap-2">
                      <Button 
                        onClick={() => {
                          setSelectedOS(null);
                          setJobId(null);
                          setCurrentJob(null);
                          setDiscoveredDevices([]);
                          setHasDownloaded(false);
                          sessionStorage.removeItem('discoveryJobId');
                        }} 
                        variant="outline"
                      >
                        Start New Discovery
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin text-primary" />
                    <h3 className="text-xl font-semibold mb-2">Preparing Download...</h3>
                  </div>
                )}
            </Card>
          </div>
        </div>
      </main>

      {/* Review Devices Modal */}
      <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Discovered Devices</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {discoveredDevices.length} device(s) found • {selectedDevices.length} selected
                {discoveredDevices.filter(d => d.enrichmentStatus === 'pending').length > 0 && (
                  <> • {discoveredDevices.filter(d => d.enrichmentStatus === 'pending').length} pending enrichment</>
                )}
              </p>
              <div className="flex gap-2">
                <Button onClick={selectAll} variant="outline" size="sm">
                  Select All
                </Button>
                {discoveredDevices.filter(d => d.enrichmentStatus === 'pending').length > 0 && (
                  <Button 
                    onClick={triggerEnrichment} 
                    variant="secondary" 
                    size="sm"
                    disabled={isEnriching}
                  >
                    {isEnriching ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enriching...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Enrich Devices
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {discoveredDevices.map((device) => (
                <Card 
                  key={device.id} 
                  className={`p-4 ${device.isDuplicate ? 'opacity-60 border-yellow-500' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={selectedDevices.includes(device.id)}
                      onCheckedChange={() => toggleDevice(device.id)}
                      disabled={device.isDuplicate}
                    />
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getDeviceIcon(device)}
                        <div className="flex-1">
                          <p className="font-semibold">
                            {device.deviceName || device.hostname || device.sysName || device.ipAddress}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {device.ipAddress} {device.macAddress && `• ${device.macAddress}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(device.status)}
                          {device.enrichmentStatus && getEnrichmentBadge(device.enrichmentStatus)}
                          {device.confidence !== undefined && device.confidence > 0 && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              {Math.round(device.confidence * 100)}%
                            </Badge>
                          )}
                        </div>
                      </div>

                      {device.manufacturer && (
                        <p className="text-sm">
                          <span className="font-medium">Manufacturer:</span> {device.manufacturer}
                          {device.model && ` • Model: ${device.model}`}
                          {device.serialNumber && ` • S/N: ${device.serialNumber}`}
                        </p>
                      )}
                      
                      {device.hostname && device.hostname !== device.deviceName && (
                        <p className="text-sm">
                          <span className="font-medium">Hostname:</span> {device.hostname}
                        </p>
                      )}
                      
                      {device.deviceType && (
                        <p className="text-sm">
                          <span className="font-medium">Type:</span> {device.deviceType}
                          {device.firmwareVersion && ` • Firmware: ${device.firmwareVersion}`}
                        </p>
                      )}
                      
                      {device.protocols && device.protocols.length > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-muted-foreground">Detected via:</span>
                          {device.protocols.map((protocol) => (
                            <Badge key={protocol} variant="secondary" className="text-xs">
                              {protocol}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {device.isDuplicate && (
                        <Alert className="mt-2 bg-yellow-50 dark:bg-yellow-950 border-yellow-200">
                          <AlertCircle className="w-4 h-4" />
                          <AlertDescription className="text-sm">
                            This device already exists in your inventory
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div>
                <Label htmlFor="siteName">Site Name (Optional)</Label>
                <Input
                  id="siteName"
                  placeholder="e.g., Headquarters"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="tags">Tags (Optional, comma-separated)</Label>
                <Input
                  id="tags"
                  placeholder="e.g., network-scan, office-devices"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={isImporting || selectedDevices.length === 0}
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                `Import ${selectedDevices.length} Device(s)`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Global Floating AI Assistant */}
      <FloatingAIAssistant />
    </div>
  );
}
