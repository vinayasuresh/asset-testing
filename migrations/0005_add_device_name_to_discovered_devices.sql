-- Add device_name column to discovered_devices table
ALTER TABLE discovered_devices ADD COLUMN IF NOT EXISTS device_name TEXT;

-- Add comment
COMMENT ON COLUMN discovered_devices.device_name IS 'Friendly device name from enrichment (e.g., "Airtel Fiber Router", "HP LaserJet Pro")';
