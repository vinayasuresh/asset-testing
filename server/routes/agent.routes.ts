import { Router, Request, Response } from "express";
import { db } from "../db";
import * as s from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";
import { buildMinimalOAXml, oaSubmitDeviceXML, oaFindDeviceId } from "../utils/openAuditClient";
import { markSyncChanged } from "../utils/syncHeartbeat";
import crypto from "crypto";

const router = Router();

/**
 * Validate agent enrollment token
 * Tokens can be:
 * 1. Environment variable AGENT_ENROLLMENT_TOKEN (static token)
 * 2. Dynamically generated tokens from enrollment-tokens endpoint
 * 3. HMAC-signed tokens with timestamp
 */
async function validateEnrollmentToken(req: Request): Promise<{ valid: boolean; tenantId?: string; error?: string }> {
  const authHeader = req.headers['authorization'];
  const tokenHeader = req.headers['x-enrollment-token'] as string | undefined;

  // Get token from either header
  let token: string | null = null;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (tokenHeader) {
    token = tokenHeader;
  }

  if (!token) {
    return { valid: false, error: 'No enrollment token provided' };
  }

  // 1. Check against static environment token (for development/simple setups)
  const staticToken = process.env.AGENT_ENROLLMENT_TOKEN;
  if (staticToken && token === staticToken) {
    return {
      valid: true,
      tenantId: process.env.ENROLL_DEFAULT_TENANT_ID || process.env.OA_TENANT_ID || process.env.DEFAULT_TENANT_ID,
    };
  }

  // 2. Check against database enrollment tokens
  try {
    const [enrollmentToken] = await db
      .select()
      .from(s.enrollmentTokens)
      .where(eq(s.enrollmentTokens.token, token))
      .limit(1);

    if (enrollmentToken) {
      // Check if token is expired
      if (enrollmentToken.expiresAt && new Date(enrollmentToken.expiresAt) < new Date()) {
        return { valid: false, error: 'Enrollment token has expired' };
      }

      // Check usage limits
      if (enrollmentToken.maxUses && enrollmentToken.usedCount >= enrollmentToken.maxUses) {
        return { valid: false, error: 'Enrollment token has reached maximum uses' };
      }

      // Update usage count
      await db
        .update(s.enrollmentTokens)
        .set({
          usedCount: (enrollmentToken.usedCount || 0) + 1,
          lastUsedAt: new Date(),
        })
        .where(eq(s.enrollmentTokens.id, enrollmentToken.id));

      return { valid: true, tenantId: enrollmentToken.tenantId };
    }
  } catch (dbError) {
    // Database table might not exist in all setups
    console.warn('[Agent Enrollment] Could not validate against database tokens:', dbError);
  }

  // 3. Check HMAC-signed token (for secure token generation)
  const enrollSecret = process.env.AGENT_ENROLLMENT_SECRET;
  if (enrollSecret) {
    try {
      // Token format: tenantId:timestamp:signature
      const parts = token.split(':');
      if (parts.length === 3) {
        const [tenantId, timestamp, signature] = parts;
        const timestampNum = parseInt(timestamp, 10);

        // Check timestamp is within 24 hours
        const now = Date.now();
        if (now - timestampNum > 24 * 60 * 60 * 1000) {
          return { valid: false, error: 'Token has expired' };
        }

        // Verify signature
        const expectedSignature = crypto
          .createHmac('sha256', enrollSecret)
          .update(`${tenantId}:${timestamp}`)
          .digest('hex');

        if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
          return { valid: true, tenantId };
        }
      }
    } catch {
      // Invalid token format
    }
  }

  return { valid: false, error: 'Invalid enrollment token' };
}

/**
 * @swagger
 * /api/agent/enroll:
 *   post:
 *     summary: Agent enrollment endpoint
 *     tags: [Agent]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - hostname
 *             properties:
 *               hostname:
 *                 type: string
 *               serial:
 *                 type: string
 *               os:
 *                 type: object
 *               username:
 *                 type: string
 *               ips:
 *                 type: array
 *               uptimeSeconds:
 *                 type: number
 *     responses:
 *       200:
 *         description: Device enrolled successfully
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Enrollment failed
 */
router.post("/enroll", async (req: Request, res: Response) => {
  try {
    // 0) Validate enrollment token (required in production)
    const requireAuth = process.env.NODE_ENV === 'production' ||
                        process.env.REQUIRE_ENROLLMENT_AUTH === 'true';

    let tenantId: string | undefined;

    if (requireAuth) {
      const tokenValidation = await validateEnrollmentToken(req);
      if (!tokenValidation.valid) {
        console.warn('[Agent Enrollment] Authentication failed:', tokenValidation.error);
        return res.status(401).json({
          ok: false,
          error: 'Unauthorized',
          details: tokenValidation.error,
        });
      }
      tenantId = tokenValidation.tenantId;
    }

    // 1) Parse & normalize input
    const body = req.body ?? {};
    const hostname = String(body.hostname ?? "").trim();
    const serial = (body.serial ?? null) ? String(body.serial).trim() : null;
    const osName = body?.os?.name ? String(body.os.name).trim() : null;
    const osVersion = body?.os?.version ? String(body.os.version).trim() : null;
    const username = (body.username ?? null) ? String(body.username).trim() : null;
    const ipsArr: string[] = Array.isArray(body.ips) ? body.ips.map((x: any) => String(x)) : [];
    const uptimeSeconds =
      Number.isFinite(Number(body.uptimeSeconds)) ? Number(body.uptimeSeconds) : null;

    // Validate hostname format (prevent injection)
    if (!hostname || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,253}[a-zA-Z0-9]?$/.test(hostname)) {
      return res.status(400).json({ ok: false, error: "Invalid hostname format" });
    }

    // Validate serial number format if provided
    if (serial && !/^[a-zA-Z0-9._-]{1,100}$/.test(serial)) {
      return res.status(400).json({ ok: false, error: "Invalid serial number format" });
    }

    // 2) Choose tenant - use token-provided tenant or fall back to defaults
    const devTenant = tenantId ||
      process.env.ENROLL_DEFAULT_TENANT_ID ||
      process.env.OA_TENANT_ID ||
      process.env.DEFAULT_TENANT_ID;
    if (!devTenant) {
      return res.status(500).json({ ok: false, error: "No default tenant configured" });
    }

    // Optional: allow skipping OA during debugging
    const skipOA = (process.env.ENROLL_SKIP_OA ?? "false").toLowerCase() === "true";
    let oaId: string | null = null;

    // 3) Upsert (by serial if present else by name)
    type NewAsset = InferInsertModel<typeof s.assets>;
    const now = new Date();

    const baseRow: NewAsset = {
      tenantId: devTenant,
      name: hostname,
      type: "Hardware",
      category: "computer",
      manufacturer: null,
      model: null,
      serialNumber: serial,
      status: "in-stock",

      location: null,
      country: null,
      state: null,
      city: null,

      assignedUserId: null,
      assignedUserName: username ?? null,
      assignedUserEmail: null,
      assignedUserEmployeeId: null,

      purchaseDate: null,
      purchaseCost: null,
      warrantyExpiry: null,
      amcExpiry: null,

      specifications: {
        agent: {
          platform: osName ?? null,
          agentVersion: "dev",
          enrollMethod: "link",
          lastCheckInAt: now.toISOString(),
          firstEnrolledAt: now.toISOString(),
          uptimeSeconds,
          lastIPs: ipsArr,
        },
      } as any,

      notes: "Enrolled via /api/agent/enroll",

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

      createdAt: now,
      updatedAt: now,
    };

    if (serial && serial.trim() !== "") {
      // ✅ Serial present → safe to use ON CONFLICT on (tenantId, serialNumber)
      await db
        .insert(s.assets)
        .values(baseRow)
        .onConflictDoUpdate({
          target: [s.assets.tenantId, s.assets.serialNumber],
          set: {
            name: baseRow.name,
            type: baseRow.type,
            category: baseRow.category,
            assignedUserName: baseRow.assignedUserName,
            specifications: baseRow.specifications,
            notes: baseRow.notes,
            updatedAt: now,
          },
        });
    } else {
      // ❌ No serial → cannot use ON CONFLICT with the partial (tenantId,name) index.
      //    Manual merge: UPDATE first (only rows where serial_number IS NULL), INSERT if none updated.
      const updated = await db
        .update(s.assets)
        .set({
          type: baseRow.type,
          category: baseRow.category,
          assignedUserName: baseRow.assignedUserName,
          specifications: baseRow.specifications,
          notes: baseRow.notes,
          updatedAt: now,
        })
        .where(
          and(
            eq(s.assets.tenantId, baseRow.tenantId),
            eq(s.assets.name, baseRow.name),
            sql`${s.assets.serialNumber} IS NULL`
          )
        )
        .returning({ id: s.assets.id });

      if (updated.length === 0) {
        await db.insert(s.assets).values(baseRow);
      }
    }

    // Re-read the asset row to get its id
    let assetId: string | null = null;
    if (serial && serial.trim() !== "") {
      const [row] = await db
        .select({ id: s.assets.id })
        .from(s.assets)
        .where(and(eq(s.assets.tenantId, devTenant), eq(s.assets.serialNumber, serial)))
        .limit(1);
      assetId = row?.id ?? null;
    }
    if (!assetId) {
      const [row] = await db
        .select({ id: s.assets.id })
        .from(s.assets)
        .where(and(eq(s.assets.tenantId, devTenant), eq(s.assets.name, hostname)))
        .limit(1);
      assetId = row?.id ?? null;
    }

    // 4) Build minimal OA XML and POST to OA (unless skipping for debug)
    if (!skipOA) {
      const primaryIp = ipsArr.find((ip) => ip && ip.includes(".")) || ipsArr[0] || null;
      const xml = buildMinimalOAXml({
        hostname,
        ip: primaryIp ?? null,
        serial,
        osName,
        osVersion,
        manufacturer: null,
        model: null,
      });
      await oaSubmitDeviceXML(xml);

      // 5) Resolve OA device id (prefer serial, fallback hostname)
      oaId = await oaFindDeviceId({ serial, hostname });

      // 6) Patch asset.specifications.openaudit.id if we got it
      if (assetId && oaId) {
        await db
          .update(s.assets)
          .set({
            specifications: {
              ...(baseRow.specifications as any),
              openaudit: {
                id: oaId,
                hostname,
                ip: primaryIp,
                os: { name: osName, version: osVersion },
              },
            } as any,
            updatedAt: new Date(),
          })
          .where(eq(s.assets.id, assetId));
      }
    }

    // 7) Process software if provided
    const softwareArr = Array.isArray(body.software) ? body.software : [];
    let softwareImported = 0;

    if (assetId && softwareArr.length > 0) {
      console.log(`[Agent Enrollment] Processing ${softwareArr.length} software items for asset ${assetId}`);

      for (const sw of softwareArr) {
        try {
          const swName = String(sw.name ?? "").trim();
          const swVersion = String(sw.version ?? "").trim();
          const swPublisher = String(sw.publisher ?? "").trim();

          if (!swName) continue;

          // Full name includes version for uniqueness
          const fullName = swVersion ? `${swName} ${swVersion}` : swName;

          // Check if software asset already exists
          const [existingSw] = await db
            .select()
            .from(s.assets)
            .where(
              and(
                eq(s.assets.tenantId, devTenant),
                eq(s.assets.name, fullName),
                eq(s.assets.type, "Software")
              )
            )
            .limit(1);

          let softwareAssetId: string;

          if (existingSw) {
            softwareAssetId = existingSw.id;
            // Update existing software
            await db
              .update(s.assets)
              .set({
                version: swVersion || null,
                manufacturer: swPublisher || null,
                updatedAt: now,
              })
              .where(eq(s.assets.id, softwareAssetId));
          } else {
            // Create new software asset
            const [newSw] = await db
              .insert(s.assets)
              .values({
                tenantId: devTenant,
                type: "Software",
                name: fullName,
                version: swVersion || null,
                manufacturer: swPublisher || null,
                status: "in-stock",
                category: "Application",
                notes: `Discovered via agent enrollment from ${hostname}`,
                specifications: null,
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
                softwareName: null,
                licenseType: null,
                licenseKey: null,
                usedLicenses: null,
                renewalDate: null,
                vendorName: null,
                vendorEmail: null,
                vendorPhone: null,
                companyName: null,
                companyGstNumber: null,
                createdAt: now,
                updatedAt: now,
              })
              .returning();

            softwareAssetId = newSw.id;
          }

          // Create link between hardware and software (if not exists)
          const [existingLink] = await db
            .select()
            .from(s.assetSoftwareLinks)
            .where(
              and(
                eq(s.assetSoftwareLinks.tenantId, devTenant),
                eq(s.assetSoftwareLinks.assetId, assetId),
                eq(s.assetSoftwareLinks.softwareAssetId, softwareAssetId)
              )
            )
            .limit(1);

          if (!existingLink) {
            await db.insert(s.assetSoftwareLinks).values({
              tenantId: devTenant,
              assetId,
              softwareAssetId,
              createdAt: now,
            });
          }

          softwareImported++;
        } catch (swErr: any) {
          // Log but don't fail the whole enrollment for one bad software item
          console.warn(`[Agent Enrollment] Failed to import software: ${sw.name}`, swErr?.message);
        }
      }

      console.log(`[Agent Enrollment] Imported ${softwareImported}/${softwareArr.length} software items`);
    }

    // 8) Notify heartbeat and return
    markSyncChanged();

    return res.json({
      ok: true,
      assetId,
      oa: { deviceId: oaId ?? null },
      softwareImported,
      message: skipOA
        ? "Device enrolled (OA skipped by ENROLL_SKIP_OA=true)."
        : "Device enrolled and posted to Open-AudIT.",
    });
  } catch (e: any) {
    console.error("[POST /api/agent/enroll] fail:", e?.message ?? e);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to enroll device", details: e?.message ?? String(e) });
  }
});

export default router;
