-- Add enrichment fields to discovered_devices table
ALTER TABLE discovered_devices
ADD COLUMN IF NOT EXISTS firmware_version TEXT,
ADD COLUMN IF NOT EXISTS device_type TEXT,
ADD COLUMN IF NOT EXISTS confidence NUMERIC(3, 2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS protocols JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS evidence JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS enrichment_status TEXT DEFAULT 'pending' CHECK (enrichment_status IN ('pending', 'enriching', 'complete', 'failed')),
ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP DEFAULT NOW();

-- Add index for enrichment status queries
CREATE INDEX IF NOT EXISTS idx_discovered_devices_enrichment_status ON discovered_devices(enrichment_status) WHERE enrichment_status IN ('pending', 'enriching');

-- Add index for device type filtering
CREATE INDEX IF NOT EXISTS idx_discovered_devices_type ON discovered_devices(device_type) WHERE device_type IS NOT NULL;

-- Add index for last_seen (for stale device cleanup)
CREATE INDEX IF NOT EXISTS idx_discovered_devices_last_seen ON discovered_devices(last_seen DESC);

-- Comments for documentation
COMMENT ON COLUMN discovered_devices.firmware_version IS 'Device firmware/OS version extracted from various protocols';
COMMENT ON COLUMN discovered_devices.device_type IS 'Detected device type: printer, switch, router, nas, camera, server, unknown';
COMMENT ON COLUMN discovered_devices.confidence IS 'Enrichment confidence score 0.0-1.0 based on data completeness';
COMMENT ON COLUMN discovered_devices.protocols IS 'Array of protocols used for discovery: SNMP, IPP, mDNS, SSDP, HTTP, ONVIF, OUI';
COMMENT ON COLUMN discovered_devices.evidence IS 'JSON object containing raw protocol responses for audit trail';
COMMENT ON COLUMN discovered_devices.enrichment_status IS 'Status of enrichment process: pending, enriching, complete, failed';
COMMENT ON COLUMN discovered_devices.enriched_at IS 'Timestamp when device was fully enriched';
COMMENT ON COLUMN discovered_devices.last_seen IS 'Last time device was discovered/seen on network';
