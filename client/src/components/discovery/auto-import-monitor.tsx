import { useEffect, useRef } from 'react';
import { authenticatedRequest } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

/**
 * Background service that monitors for new discovery scans and automatically imports devices.
 * Runs globally across all pages once user is authenticated.
 */
export function AutoImportMonitor() {
  const { toast } = useToast();
  const processedJobsRef = useRef<Set<string>>(new Set());
  const isProcessingRef = useRef(false);

  useEffect(() => {
    console.log('[AutoImport] Starting global auto-import monitor');

    const checkForNewDevices = async () => {
      // Prevent concurrent executions
      if (isProcessingRef.current) {
        return;
      }

      isProcessingRef.current = true;

      try {
        // Fetch all recent discovery jobs
        const response: any = await authenticatedRequest('GET', '/api/discovery/jobs/recent');
        
        if (response.jobs && response.jobs.length > 0) {
          for (const job of response.jobs) {
            // Skip if already processed
            if (processedJobsRef.current.has(job.jobId)) {
              continue;
            }

            // Fetch devices for this job
            const jobData: any = await authenticatedRequest('GET', `/api/discovery/jobs/${job.jobId}`);
            const devices = jobData.devices || [];

            if (devices.length > 0) {
              // Filter devices that need importing
              const devicesToImport = devices.filter((d: any) => !d.isImported && !d.isDuplicate);

              if (devicesToImport.length > 0) {
                console.log(`[AutoImport] Auto-importing ${devicesToImport.length} devices from job ${job.jobId}`);
                
                const deviceIds = devicesToImport.map((d: any) => d.id);

                try {
                  await authenticatedRequest('POST', '/api/discovery/import', {
                    jobId: jobData.job.id,
                    deviceIds: deviceIds,
                    siteName: null,
                    tags: ['auto-discovered'],
                  });

                  console.log(`[AutoImport] Successfully imported ${devicesToImport.length} devices`);

                  toast({
                    title: "Devices Auto-Imported!",
                    description: `Added ${devicesToImport.length} device(s) from scan ${job.jobId} to your inventory`,
                  });

                  // Mark job as processed
                  processedJobsRef.current.add(job.jobId);
                } catch (error: any) {
                  console.error(`[AutoImport] Failed to import devices from job ${job.jobId}:`, error);
                  
                  toast({
                    title: "Auto-import failed",
                    description: `Could not import devices from scan ${job.jobId}`,
                    variant: "destructive",
                  });
                }
              } else if (devices.length > 0) {
                // All devices already imported or are duplicates
                console.log(`[AutoImport] Job ${job.jobId} has ${devices.length} devices but all are duplicates or already imported`);
                processedJobsRef.current.add(job.jobId);
              }
            }
          }
        }
      } catch (error: any) {
        // Silently fail if not authenticated or other errors
        console.error('[AutoImport] Error checking for new devices:', error);
      } finally {
        isProcessingRef.current = false;
      }
    };

    // Check immediately on mount
    checkForNewDevices();

    // Then check every 10 seconds
    const interval = setInterval(checkForNewDevices, 10000);

    return () => {
      console.log('[AutoImport] Stopping global auto-import monitor');
      clearInterval(interval);
    };
  }, [toast]);

  // This component doesn't render anything
  return null;
}
