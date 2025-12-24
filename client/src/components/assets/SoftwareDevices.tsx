import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Monitor, Loader2, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { authenticatedRequest } from "@/lib/auth";

interface SoftwareDevicesProps {
  softwareId: string;
  softwareName: string;
}

export function SoftwareDevices({ softwareId, softwareName }: SoftwareDevicesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();

  const { data, isLoading } = useQuery({
    queryKey: [`/api/software/${softwareId}/devices`],
    queryFn: async () => {
      const response = await authenticatedRequest("GET", `/api/software/${softwareId}/devices`);
      return response.json();
    },
    enabled: isOpen, // Only fetch when dialog is open
  });

  const devices = data?.devices || [];

  const handleDeviceClick = (deviceId: string) => {
    setIsOpen(false);
    // Navigate to hardware assets and open device details
    setLocation(`/assets?type=Hardware&view=${deviceId}`);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="h-7 px-2 text-xs"
      >
        <Monitor className="h-3 w-3 mr-1" />
        {devices.length > 0 ? `${devices.length} devices` : "View devices"}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Devices with {softwareName}
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : devices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Monitor className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>No devices found with this software installed</p>
            </div>
          ) : (
            <div className="space-y-2">
              {devices.map((device: any) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => handleDeviceClick(device.id)}
                >
                  <div className="flex items-center space-x-3">
                    <Monitor className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{device.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {device.manufacturer || "Unknown"} {device.model ? `• ${device.model}` : ""}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
