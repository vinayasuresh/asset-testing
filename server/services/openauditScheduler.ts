// server/services/openauditScheduler.ts
import { log } from "../vite";
import { db } from "../db";
import { tenants } from "@shared/schema";
import { syncOpenAuditFirstPage } from "./openauditSync";

const SYNC_INTERVAL_MS = 1 * 60 * 1000; // 1 minute (for testing)

export function startOpenAuditScheduler() {
  log("OA sync scheduler: Starting tenant-specific sync from Open-AudIT...");
  log("Each tenant syncs from their assigned Open-AudIT organization.");
  
  // Initial sync
  syncAllTenants();
  
  // Schedule periodic sync
  setInterval(() => {
    syncAllTenants();
  }, SYNC_INTERVAL_MS);
}

async function syncAllTenants() {
  try {
    // Get all tenants with Open-AudIT org mapping
    const allTenants = await db.select().from(tenants);
    
    for (const tenant of allTenants) {
      if (!tenant.openauditOrgId) {
        log(`⚠️  Tenant ${tenant.name} has no Open-AudIT org mapping, skipping sync`);
        continue;
      }
      
      try {
        log(`🔄 Syncing tenant: ${tenant.name} (OA Org: ${tenant.openauditOrgId})`);
        
        const result = await syncOpenAuditFirstPage(
          tenant.id,
          500, // Fetch up to 500 devices per sync
          process.env.OPEN_AUDIT_URL,
          process.env.OPEN_AUDIT_USERNAME,
          process.env.OPEN_AUDIT_PASSWORD,
          tenant.openauditOrgId
        );
        
        log(`✓ Synced ${result.imported} devices for tenant ${tenant.name} (${result.total} total in OA)`);
      } catch (error: any) {
        log(`❌ Failed to sync tenant ${tenant.name}: ${error.message}`);
      }
    }
  } catch (error: any) {
    log(`❌ Failed to sync tenants: ${error.message}`);
  }
}
