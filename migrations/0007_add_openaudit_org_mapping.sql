-- Add OpenAudit organization ID mapping for each tenant
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS openaudit_org_id TEXT;

-- Map h&m to Nike organization in OpenAudit (you can see it has 0 devices currently)
-- You'll need to get the actual org ID from OpenAudit API
-- For now, we'll set it based on the name
UPDATE tenants 
SET openaudit_org_id = '2'  -- This is the Nike org from your screenshot
WHERE name = 'h&m';
