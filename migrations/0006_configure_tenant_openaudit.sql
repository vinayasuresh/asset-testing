-- Update h&m tenant with OpenAudit configuration
UPDATE tenants 
SET 
  openaudit_url = 'https://open-audit.vistrivetech.com',
  openaudit_username = 'admin',
  openaudit_password = 'vistrivetech',
  openaudit_sync_enabled = true,
  openaudit_sync_cron = '*/1 * * * *'
WHERE name = 'h&m';

-- Also update any tenant with the old OA_TENANT_ID for backward compatibility
UPDATE tenants 
SET 
  openaudit_url = 'https://open-audit.vistrivetech.com',
  openaudit_username = 'admin',
  openaudit_password = 'vistrivetech',
  openaudit_sync_enabled = true,
  openaudit_sync_cron = '*/1 * * * *'
WHERE id = '7936bd81-41bc-4bed-aa62-ad1f9543716f'
  AND openaudit_url IS NULL;
