// server/services/openauditSync.ts
import { oaFetchDevicesFirstPage } from "../utils/openAuditClient";
import { db } from "../db";
import { assets } from "@shared/schema";
import type { InferInsertModel } from "drizzle-orm";
import { and, eq, sql } from "drizzle-orm";
import { markSyncChanged, markSyncTick } from "../utils/syncHeartbeat";

/** 1️⃣ Type alias for Insert model */
type NewAsset = InferInsertModel<typeof assets>;

/** 2️⃣ Helper to convert empty strings -> null */
const toNullIfEmpty = (v: unknown) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

/** 3️⃣ Choose a name for each OA device */
function pickName(a: any): string {
  return (
    (a?.hostname && String(a.hostname).trim()) ||
    (a?.name && String(a.name).trim()) ||
    (a?.ip && `device-${a.ip}`) ||
    "Unnamed OA Device"
  );
}

/** 4️⃣ Map OA device → Asset shape */
function mapOADeviceToAsset(d: any, tenantId: string): NewAsset {
  const a = d?.attributes ?? {};
  return {
    tenantId,
    name: pickName(a),
    type: "Hardware",

    // 🔁 Category in ITAM ← OA device type
    category: toNullIfEmpty(a.type),

    manufacturer: toNullIfEmpty(a.manufacturer),
    model: toNullIfEmpty(a.model),
    serialNumber: toNullIfEmpty(a.serial),

    status: "in-stock",
    location: null,
    country: null,
    state: null,
    city: null,

    assignedUserId: null,
    assignedUserName: null,
    assignedUserEmail: null,
    assignedUserEmployeeId: null,

    purchaseDate: null,
    purchaseCost: null,
    warrantyExpiry: null,
    amcExpiry: null,

    specifications: {
      openaudit: {
        id: d?.id ?? null,
        hostname: toNullIfEmpty(a.hostname),
        ip: toNullIfEmpty(a.ip),
        os: {
          name: toNullIfEmpty(a.os_name),
          version: toNullIfEmpty(a.os_version),
        },
        firstSeen: toNullIfEmpty(a.first_seen),
        lastSeen: toNullIfEmpty(a.last_seen),
      },
    } as any,

    notes: "Imported from Open-AudIT",

    // Software-specific columns remain null for hardware rows
    softwareName: null,
    version: null,
    licenseType: null,
    licenseKey: null,
    usedLicenses: null,
    renewalDate: null,

    vendorName: null,
    vendorEmail: null,
    vendorPhone: null,

    companyName: null,
    companyGstNumber: null,
  };
}

/**
 * 5️⃣ Upsert into DB (serial-first; manual merge when serial is missing)
 *
 * Why: We replaced the strict unique (tenant_id, name) with a **partial** unique
 *      (tenant_id, name) WHERE serial_number IS NULL to allow serial to be the
 *      canonical identity. Postgres cannot target a partial index in
 *      ON CONFLICT(target ...), so when serial is missing we do:
 *        UPDATE ... WHERE tenant_id=? AND name=? AND serial_number IS NULL
 *        IF rowCount == 0 → INSERT (no ON CONFLICT)
 */
async function upsertAsset(row: NewAsset) {
  const now = new Date();

  // ✅ Serial present → we can use ON CONFLICT (tenant_id, serial_number)
  if (row.serialNumber && String(row.serialNumber).trim() !== "") {
    await db
      .insert(assets)
      .values(row)
      .onConflictDoUpdate({
        target: [assets.tenantId, assets.serialNumber],
        set: {
          name: row.name,
          type: row.type,
          category: row.category,
          manufacturer: row.manufacturer,
          model: row.model,
          specifications: row.specifications,
          notes: row.notes,
          updatedAt: now,
        },
      });
    return;
  }

  // ❌ No serial → cannot target partial name index with ON CONFLICT.
  //    Do a manual merge: UPDATE first, then INSERT if nothing updated.
  const updated = await db
    .update(assets)
    .set({
      type: row.type,
      category: row.category,
      manufacturer: row.manufacturer,
      model: row.model,
      specifications: row.specifications,
      notes: row.notes,
      updatedAt: now,
    })
    .where(
      and(
        eq(assets.tenantId, row.tenantId),
        eq(assets.name, row.name),
        sql`${assets.serialNumber} IS NULL`
      )
    )
    .returning({ id: assets.id });

  if (updated.length === 0) {
    await db.insert(assets).values(row);
  }
}

/** 6️⃣ Main sync function */
export async function syncOpenAuditFirstPage(
  tenantId: string, 
  limit = 50,
  oaBaseUrl?: string,
  oaUsername?: string,
  oaPassword?: string,
  oaOrgId?: string | number
) {
  const payload = await oaFetchDevicesFirstPage(limit, oaBaseUrl, oaUsername, oaPassword, oaOrgId);
  const items: any[] = payload?.data ?? [];
  const total: number = payload?.meta?.total ?? items.length;

  for (const d of items) {
    const row = mapOADeviceToAsset(d, tenantId);
    await upsertAsset(row);
  }

  // 👇 heartbeat: tell the frontend whether something changed this run
  if (items.length > 0) {
    markSyncChanged();
  } else {
    markSyncTick();
  }

  return { imported: items.length, total };
}
