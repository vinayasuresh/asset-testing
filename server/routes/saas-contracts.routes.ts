import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { authenticateToken, requireRole } from "../middleware/auth.middleware";
import { auditLogger, AuditActions, ResourceTypes } from "../audit-logger";
import { insertSaasContractSchema } from "@shared/schema";
import { z } from "zod";
import { policyEngine } from "../services/policy/engine";
import multer from "multer";
import { AIContractExtractor } from "../services/contracts/ai-extractor";
import { ContractPDFStorage } from "../services/contracts/pdf-storage";
import { DuplicateVendorDetector } from "../services/contracts/duplicate-vendor-detector";

const router = Router();

// File upload configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Service instances
const pdfStorage = new ContractPDFStorage();
const aiExtractor = new AIContractExtractor();

/**
 * @swagger
 * /api/saas-contracts:
 *   get:
 *     summary: Get all SaaS contracts
 *     tags: [SaaS Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, expired, cancelled, pending]
 *       - in: query
 *         name: appId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contracts retrieved successfully
 */
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { status, appId } = req.query;

    const contracts = await storage.getSaasContracts(req.user!.tenantId, {
      status: status as string,
      appId: appId as string
    });

    res.json(contracts);
  } catch (error) {
    console.error('Failed to fetch SaaS contracts:', error);
    res.status(500).json({ message: "Failed to fetch SaaS contracts" });
  }
});

/**
 * @swagger
 * /api/saas-contracts/renewals:
 *   get:
 *     summary: Get upcoming contract renewals
 *     tags: [SaaS Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: Upcoming renewals retrieved successfully
 */
router.get("/renewals", authenticateToken, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const renewals = await storage.getUpcomingRenewals(req.user!.tenantId, days);

    // Emit policy events for approaching renewals
    const eventSystem = policyEngine.getEventSystem();
    for (const renewal of renewals) {
      if (renewal.renewalDate) {
        const daysUntilRenewal = Math.ceil(
          (new Date(renewal.renewalDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        eventSystem.emit('contract.renewal_approaching', {
          tenantId: req.user!.tenantId,
          contractId: renewal.id,
          appId: renewal.appId || '',
          appName: renewal.vendor || 'Unknown',
          daysUntilRenewal,
          contractValue: renewal.annualValue || 0,
          autoRenew: renewal.autoRenew || false
        });
      }
    }

    res.json(renewals);
  } catch (error) {
    console.error('Failed to fetch upcoming renewals:', error);
    res.status(500).json({ message: "Failed to fetch renewals" });
  }
});

/**
 * @swagger
 * /api/saas-contracts/{id}:
 *   get:
 *     summary: Get a single SaaS contract
 *     tags: [SaaS Contracts]
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
 *         description: Contract retrieved successfully
 *       404:
 *         description: Contract not found
 */
router.get("/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const contract = await storage.getSaasContract(req.params.id, req.user!.tenantId);

    if (!contract) {
      return res.status(404).json({ message: "Contract not found" });
    }

    res.json(contract);
  } catch (error) {
    console.error('Failed to fetch contract:', error);
    res.status(500).json({ message: "Failed to fetch contract" });
  }
});

/**
 * @swagger
 * /api/saas-contracts:
 *   post:
 *     summary: Create a new SaaS contract
 *     tags: [SaaS Contracts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Contract created successfully
 */
router.post("/", authenticateToken, requireRole("it-manager"), async (req: Request, res: Response) => {
  try {
    const contractData = insertSaasContractSchema.parse({
      ...req.body,
      tenantId: req.user!.tenantId,
    });

    const contract = await storage.createSaasContract(contractData);

    // Audit log
    await auditLogger.logActivity(
      auditLogger.createUserContext(req),
      {
        action: AuditActions.CREATE,
        resourceType: ResourceTypes.SAAS_CONTRACT,
        resourceId: contract.id,
        description: `Created SaaS contract for: ${contract.vendor}`,
        afterState: auditLogger.sanitizeForLogging(contract)
      },
      req
    );

    res.status(201).json(contract);
  } catch (error) {
    console.error('Failed to create contract:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.errors
      });
    }

    res.status(500).json({ message: "Failed to create contract" });
  }
});

/**
 * @swagger
 * /api/saas-contracts/{id}:
 *   put:
 *     summary: Update a SaaS contract
 *     tags: [SaaS Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Contract updated successfully
 *       404:
 *         description: Contract not found
 */
router.put("/:id", authenticateToken, requireRole("it-manager"), async (req: Request, res: Response) => {
  try {
    const originalContract = await storage.getSaasContract(req.params.id, req.user!.tenantId);

    const contractData = insertSaasContractSchema.partial().parse(req.body);
    const contract = await storage.updateSaasContract(req.params.id, req.user!.tenantId, contractData);

    if (!contract) {
      return res.status(404).json({ message: "Contract not found" });
    }

    // Audit log
    await auditLogger.logActivity(
      auditLogger.createUserContext(req),
      {
        action: AuditActions.UPDATE,
        resourceType: ResourceTypes.SAAS_CONTRACT,
        resourceId: contract.id,
        description: `Updated SaaS contract for: ${contract.vendor}`,
        beforeState: originalContract,
        afterState: contract
      },
      req
    );

    res.json(contract);
  } catch (error) {
    console.error('Failed to update contract:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.errors
      });
    }

    res.status(500).json({ message: "Failed to update contract" });
  }
});

/**
 * @swagger
 * /api/saas-contracts/{id}/renewal-alert:
 *   patch:
 *     summary: Mark contract renewal as alerted
 *     tags: [SaaS Contracts]
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
 *         description: Renewal alert updated successfully
 */
router.patch("/:id/renewal-alert", authenticateToken, requireRole("it-manager"), async (req: Request, res: Response) => {
  try {
    const contract = await storage.updateRenewalAlerted(req.params.id, req.user!.tenantId);

    if (!contract) {
      return res.status(404).json({ message: "Contract not found" });
    }

    res.json(contract);
  } catch (error) {
    console.error('Failed to update renewal alert:', error);
    res.status(500).json({ message: "Failed to update renewal alert" });
  }
});

/**
 * @swagger
 * /api/saas-contracts/{id}:
 *   delete:
 *     summary: Delete a SaaS contract
 *     tags: [SaaS Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Contract deleted successfully
 *       404:
 *         description: Contract not found
 */
router.delete("/:id", authenticateToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const contract = await storage.getSaasContract(req.params.id, req.user!.tenantId);
    const success = await storage.deleteSaasContract(req.params.id, req.user!.tenantId);

    if (!success) {
      return res.status(404).json({ message: "Contract not found" });
    }

    // Audit log
    if (contract) {
      await auditLogger.logActivity(
        auditLogger.createUserContext(req),
        {
          action: AuditActions.DELETE,
          resourceType: ResourceTypes.SAAS_CONTRACT,
          resourceId: req.params.id,
          description: `Deleted SaaS contract for: ${contract.vendor}`,
          beforeState: contract
        },
        req
      );
    }

    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete contract:', error);
    res.status(500).json({ message: "Failed to delete contract" });
  }
});

/**
 * @swagger
 * /api/saas-contracts/{id}/upload-pdf:
 *   post:
 *     summary: Upload contract PDF and extract data using AI
 *     tags: [SaaS Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               autoExtract:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: PDF uploaded and processed successfully
 */
router.post("/:id/upload-pdf", authenticateToken, requireRole("it-manager"), upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No PDF file provided" });
    }

    const contractId = req.params.id;
    const tenantId = req.user!.tenantId;
    const autoExtract = req.body.autoExtract !== 'false';

    // Verify contract exists
    const existingContract = await storage.getSaasContract(contractId, tenantId);
    if (!existingContract) {
      return res.status(404).json({ message: "Contract not found" });
    }

    // Store the PDF
    const storageInfo = await pdfStorage.storeContract(
      req.file.buffer,
      req.file.originalname,
      tenantId,
      contractId
    );

    let extractedData = null;
    let extractionWarnings: string[] = [];

    // Extract data using AI if enabled
    if (autoExtract) {
      try {
        extractedData = await aiExtractor.extractFromPDF(req.file.buffer);
        const validation = aiExtractor.validateExtraction(extractedData);
        extractionWarnings = validation.warnings;

        // Update contract with extracted data (only non-null fields)
        const updateData: Record<string, any> = {};
        if (extractedData.vendor && !existingContract.vendor) {
          updateData.vendor = extractedData.vendor;
        }
        if (extractedData.startDate) {
          updateData.startDate = extractedData.startDate;
        }
        if (extractedData.endDate) {
          updateData.endDate = extractedData.endDate;
        }
        if (extractedData.renewalDate) {
          updateData.renewalDate = extractedData.renewalDate;
        }
        if (extractedData.autoRenew !== undefined) {
          updateData.autoRenew = extractedData.autoRenew;
        }
        if (extractedData.annualValue) {
          updateData.annualValue = extractedData.annualValue;
        }
        if (extractedData.billingCycle) {
          updateData.billingCycle = extractedData.billingCycle;
        }
        if (extractedData.noticePeriodDays) {
          updateData.noticePeriodDays = extractedData.noticePeriodDays;
        }
        if (extractedData.totalLicenses) {
          updateData.totalLicenses = extractedData.totalLicenses;
        }
        if (extractedData.terms) {
          updateData.terms = extractedData.terms;
        }

        // Add PDF path to contract
        updateData.documentPath = storageInfo.filePath;

        if (Object.keys(updateData).length > 0) {
          await storage.updateSaasContract(contractId, tenantId, updateData);
        }
      } catch (extractError: any) {
        console.error('AI extraction failed:', extractError);
        extractionWarnings.push(`AI extraction failed: ${extractError.message}`);
      }
    } else {
      // Just store the document path
      await storage.updateSaasContract(contractId, tenantId, {
        documentPath: storageInfo.filePath
      });
    }

    // Audit log
    await auditLogger.logActivity(
      auditLogger.createUserContext(req),
      {
        action: AuditActions.UPDATE,
        resourceType: ResourceTypes.SAAS_CONTRACT,
        resourceId: contractId,
        description: `Uploaded PDF for contract: ${existingContract.vendor}`,
        afterState: { storageInfo, extractedData }
      },
      req
    );

    // Emit event
    policyEngine.getEventSystem().emit('contract.pdf_uploaded', {
      tenantId,
      contractId,
      vendor: existingContract.vendor,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      extractedData: extractedData ? true : false
    });

    res.json({
      message: "PDF uploaded successfully",
      storageInfo,
      extractedData,
      extractionWarnings,
      extractionConfidence: extractedData?.extractionConfidence
    });
  } catch (error: any) {
    console.error('Failed to upload contract PDF:', error);
    res.status(500).json({ message: error.message || "Failed to upload contract PDF" });
  }
});

/**
 * @swagger
 * /api/saas-contracts/{id}/download-pdf:
 *   get:
 *     summary: Download contract PDF
 *     tags: [SaaS Contracts]
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
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get("/:id/download-pdf", authenticateToken, async (req: Request, res: Response) => {
  try {
    const contract = await storage.getSaasContract(req.params.id, req.user!.tenantId);

    if (!contract) {
      return res.status(404).json({ message: "Contract not found" });
    }

    if (!contract.documentPath) {
      return res.status(404).json({ message: "No PDF file attached to this contract" });
    }

    const pdfBuffer = await pdfStorage.getContract(contract.documentPath);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${contract.vendor}_contract.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('Failed to download contract PDF:', error);
    res.status(500).json({ message: error.message || "Failed to download contract PDF" });
  }
});

/**
 * @swagger
 * /api/saas-contracts/{id}/extract:
 *   post:
 *     summary: Re-extract data from uploaded PDF using AI
 *     tags: [SaaS Contracts]
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
 *         description: Data extracted successfully
 */
router.post("/:id/extract", authenticateToken, requireRole("it-manager"), async (req: Request, res: Response) => {
  try {
    const contract = await storage.getSaasContract(req.params.id, req.user!.tenantId);

    if (!contract) {
      return res.status(404).json({ message: "Contract not found" });
    }

    if (!contract.documentPath) {
      return res.status(400).json({ message: "No PDF file attached to this contract" });
    }

    const pdfBuffer = await pdfStorage.getContract(contract.documentPath);
    const extractedData = await aiExtractor.extractFromPDF(pdfBuffer);
    const validation = aiExtractor.validateExtraction(extractedData);

    res.json({
      extractedData,
      warnings: validation.warnings,
      valid: validation.valid
    });
  } catch (error: any) {
    console.error('Failed to extract contract data:', error);
    res.status(500).json({ message: error.message || "Failed to extract contract data" });
  }
});

/**
 * @swagger
 * /api/saas-contracts/check-duplicate:
 *   post:
 *     summary: Check for duplicate vendors
 *     tags: [SaaS Contracts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               vendorName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Duplicate check results
 */
router.post("/check-duplicate", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { vendorName } = req.body;

    if (!vendorName) {
      return res.status(400).json({ message: "Vendor name is required" });
    }

    const detector = new DuplicateVendorDetector(req.user!.tenantId);
    const result = await detector.checkVendorDuplication(vendorName);

    res.json(result);
  } catch (error: any) {
    console.error('Failed to check for duplicate vendor:', error);
    res.status(500).json({ message: error.message || "Failed to check for duplicate vendor" });
  }
});

/**
 * @swagger
 * /api/saas-contracts/duplicates:
 *   get:
 *     summary: Get all duplicate vendors in the tenant
 *     tags: [SaaS Contracts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of duplicate vendors
 */
router.get("/duplicates", authenticateToken, async (req: Request, res: Response) => {
  try {
    const detector = new DuplicateVendorDetector(req.user!.tenantId);
    const duplicates = await detector.findAllDuplicates();

    res.json(duplicates);
  } catch (error: any) {
    console.error('Failed to find duplicate vendors:', error);
    res.status(500).json({ message: error.message || "Failed to find duplicate vendors" });
  }
});

export default router;
