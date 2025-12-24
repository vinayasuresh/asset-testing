import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { authenticateToken, requireRole } from "../middleware/auth.middleware";
import { insertSiteSchema } from "@shared/schema";

const router = Router();

/**
 * @swagger
 * /api/sites:
 *   get:
 *     summary: Get all sites for the tenant
 *     tags: [Sites]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of sites
 */
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const sites = await storage.getSites(tenantId);
    return res.json(sites);
  } catch (error: any) {
    console.error("Error fetching sites:", error);
    return res.status(500).json({
      message: "Failed to fetch sites",
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/sites/{id}:
 *   get:
 *     summary: Get a specific site
 *     tags: [Sites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Site details
 *       404:
 *         description: Site not found
 */
router.get("/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const site = await storage.getSite(id, tenantId);

    if (!site) {
      return res.status(404).json({ message: "Site not found" });
    }

    return res.json(site);
  } catch (error: any) {
    console.error("Error fetching site:", error);
    return res.status(500).json({
      message: "Failed to fetch site",
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/sites:
 *   post:
 *     summary: Create a new site
 *     tags: [Sites]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               country:
 *                 type: string
 *               siteType:
 *                 type: string
 *                 enum: [office, datacenter, warehouse, remote, branch]
 *     responses:
 *       201:
 *         description: Site created successfully
 */
router.post("/", authenticateToken, requireRole(["admin", "it-manager"]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    const validatedData = insertSiteSchema.parse({
      ...req.body,
      tenantId
    });

    const site = await storage.createSite(validatedData);
    return res.status(201).json(site);
  } catch (error: any) {
    console.error("Error creating site:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({
        message: "Validation error",
        errors: error.errors
      });
    }
    return res.status(500).json({
      message: "Failed to create site",
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/sites/{id}:
 *   put:
 *     summary: Update a site
 *     tags: [Sites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Site updated successfully
 *       404:
 *         description: Site not found
 */
router.put("/:id", authenticateToken, requireRole(["admin", "it-manager"]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    const existingSite = await storage.getSite(id, tenantId);
    if (!existingSite) {
      return res.status(404).json({ message: "Site not found" });
    }

    const updatedSite = await storage.updateSite(id, tenantId, req.body);
    return res.json(updatedSite);
  } catch (error: any) {
    console.error("Error updating site:", error);
    return res.status(500).json({
      message: "Failed to update site",
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/sites/{id}:
 *   delete:
 *     summary: Delete a site
 *     tags: [Sites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Site deleted successfully
 *       404:
 *         description: Site not found
 */
router.delete("/:id", authenticateToken, requireRole(["admin"]), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    const deleted = await storage.deleteSite(id, tenantId);
    if (!deleted) {
      return res.status(404).json({ message: "Site not found" });
    }

    return res.json({ message: "Site deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting site:", error);
    return res.status(500).json({
      message: "Failed to delete site",
      error: error.message
    });
  }
});

export default router;
