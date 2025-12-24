/**
 * T&C Legal Analysis Routes
 *
 * API endpoints for Terms & Conditions risk scanning and legal analysis
 */

import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { authenticateToken, requireRole } from "../middleware/auth.middleware";
import { auditLogger, AuditActions, ResourceTypes } from "../audit-logger";
import { TcLegalAnalyzer } from "../services/contracts/tc-legal-analyzer";
import { z } from "zod";

const router = Router();

// Validation schemas
const analyzeUrlSchema = z.object({
  appId: z.string().min(1),
  termsUrl: z.string().url().optional(),
  privacyPolicyUrl: z.string().url().optional(),
  eulaUrl: z.string().url().optional(),
  dpaUrl: z.string().url().optional(),
});

const quickCheckSchema = z.object({
  appName: z.string().min(1),
  termsUrl: z.string().url().optional(),
  privacyUrl: z.string().url().optional(),
});

const updateApprovalSchema = z.object({
  approvalStatus: z.enum(["pending", "approved", "rejected", "needs_review"]),
  reviewNotes: z.string().optional(),
});

/**
 * @swagger
 * /api/tc-legal/analyze:
 *   post:
 *     summary: Analyze T&C/Privacy Policy for a SaaS app
 *     tags: [T&C Legal Analysis]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               appId:
 *                 type: string
 *               termsUrl:
 *                 type: string
 *               privacyPolicyUrl:
 *                 type: string
 *               eulaUrl:
 *                 type: string
 *               dpaUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Analysis completed successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Analysis failed
 */
router.post("/analyze", authenticateToken, requireRole(["admin", "it-manager"]), async (req: Request, res: Response) => {
  try {
    const validatedData = analyzeUrlSchema.parse(req.body);
    const { appId, termsUrl, privacyPolicyUrl, eulaUrl, dpaUrl } = validatedData;

    if (!termsUrl && !privacyPolicyUrl && !eulaUrl) {
      return res.status(400).json({ message: "At least one URL (terms, privacy policy, or EULA) is required" });
    }

    // Get app info
    const app = await storage.getSaasAppById(req.user!.tenantId, appId);
    if (!app) {
      return res.status(404).json({ message: "SaaS app not found" });
    }

    // Initialize analyzer
    const analyzer = new TcLegalAnalyzer(req.user!.tenantId, {
      requireIndiaCompliance: true, // Enable India-specific checks
    });

    // Analyze the primary URL
    const primaryUrl = termsUrl || privacyPolicyUrl || eulaUrl!;
    console.log(`[TC Legal] Analyzing T&C for app: ${app.name} from URL: ${primaryUrl}`);

    const analysis = await analyzer.analyzeFromUrl(primaryUrl);

    // Store the analysis result
    const savedAnalysis = await storage.createTcLegalAnalysis(req.user!.tenantId, {
      tenantId: req.user!.tenantId,
      appId,
      termsUrl: termsUrl || null,
      privacyPolicyUrl: privacyPolicyUrl || null,
      eulaUrl: eulaUrl || null,
      dpaUrl: dpaUrl || null,
      analysisVersion: "1.0",
      documentHash: analysis.documentHash,
      aiModel: "gpt-4o",
      overallRiskScore: analysis.overallRiskScore,
      riskLevel: analysis.riskLevel,
      dataResidency: analysis.dataResidency,
      dataResidencyCompliant: analysis.dataResidencyCompliant,
      dataOwnership: analysis.dataOwnership,
      dataRetention: analysis.dataRetention,
      dataDeletion: analysis.dataDeletion,
      dataPortability: analysis.dataPortability,
      subprocessorsAllowed: analysis.subprocessorsAllowed,
      subprocessorsList: analysis.subprocessorsList,
      thirdPartySharing: analysis.thirdPartySharing,
      securityCertifications: analysis.securityCertifications,
      encryptionClaims: analysis.encryptionClaims,
      breachNotificationDays: analysis.breachNotificationDays,
      governingLaw: analysis.governingLaw,
      disputeResolution: analysis.disputeResolution,
      liabilityLimitation: analysis.liabilityLimitation,
      indemnification: analysis.indemnification,
      terminationRights: analysis.terminationRights,
      terminationNoticeDays: analysis.terminationNoticeDays,
      dataExportOnTermination: analysis.dataExportOnTermination,
      ipOwnership: analysis.ipOwnership,
      confidentialityTerms: analysis.confidentialityTerms,
      uptimeGuarantee: analysis.uptimeGuarantee,
      slaPenalties: analysis.slaPenalties,
      supportTerms: analysis.supportTerms,
      autoRenewalClause: analysis.autoRenewalClause,
      priceChangeNotice: analysis.priceChangeNotice,
      aiDataUsage: analysis.aiDataUsage,
      aiOptOut: analysis.aiOptOut,
      gdprCompliant: analysis.gdprCompliant,
      dpdpCompliant: analysis.dpdpCompliant,
      hipaaCompliant: analysis.hipaaCompliant,
      soc2Compliant: analysis.soc2Compliant,
      riskFlags: analysis.riskFlags,
      regulatoryMapping: analysis.regulatoryMapping,
      keyClauses: analysis.keyClauses,
      executiveSummary: analysis.executiveSummary,
      recommendations: analysis.recommendations,
      confidenceScore: analysis.confidenceScore,
      manualReviewRequired: analysis.manualReviewRequired,
      approvalStatus: analysis.manualReviewRequired ? "needs_review" : "pending",
    });

    // Update app risk score based on analysis
    await storage.updateSaasApp(req.user!.tenantId, appId, {
      riskScore: analysis.overallRiskScore,
      riskFactors: analysis.riskFlags.map(f => `${f.category}: ${f.concern}`),
    });

    // Audit log
    auditLogger.log({
      tenantId: req.user!.tenantId,
      userId: req.user!.id,
      action: AuditActions.CREATE,
      resourceType: 'tc_legal_analysis' as ResourceTypes,
      resourceId: savedAnalysis.id,
      details: {
        appId,
        appName: app.name,
        riskScore: analysis.overallRiskScore,
        riskLevel: analysis.riskLevel,
      },
    });

    res.json({
      id: savedAnalysis.id,
      appId,
      appName: app.name,
      ...analysis,
    });
  } catch (error) {
    console.error("T&C analysis failed:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid request", errors: error.errors });
    }

    res.status(500).json({
      message: "T&C analysis failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * @swagger
 * /api/tc-legal/quick-check:
 *   post:
 *     summary: Quick risk assessment without full analysis
 *     tags: [T&C Legal Analysis]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               appName:
 *                 type: string
 *               termsUrl:
 *                 type: string
 *               privacyUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Quick risk check completed
 */
router.post("/quick-check", authenticateToken, async (req: Request, res: Response) => {
  try {
    const validatedData = quickCheckSchema.parse(req.body);
    const { appName, termsUrl, privacyUrl } = validatedData;

    const analyzer = new TcLegalAnalyzer(req.user!.tenantId);
    const result = await analyzer.quickRiskCheck(appName, termsUrl, privacyUrl);

    res.json(result);
  } catch (error) {
    console.error("Quick risk check failed:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid request", errors: error.errors });
    }

    res.status(500).json({
      message: "Quick risk check failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * @swagger
 * /api/tc-legal:
 *   get:
 *     summary: Get all T&C analyses for tenant
 *     tags: [T&C Legal Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: riskLevel
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *       - in: query
 *         name: approvalStatus
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, needs_review]
 *       - in: query
 *         name: appId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Analyses retrieved successfully
 */
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { riskLevel, approvalStatus, appId } = req.query;

    const analyses = await storage.getTcLegalAnalyses(req.user!.tenantId, {
      riskLevel: riskLevel as string,
      approvalStatus: approvalStatus as string,
      appId: appId as string,
    });

    // Join with app data
    const apps = await storage.getSaasApps(req.user!.tenantId);
    const appsMap = new Map(apps.map(a => [a.id, a]));

    const enrichedAnalyses = analyses.map(analysis => ({
      ...analysis,
      app: appsMap.get(analysis.appId) || null,
    }));

    res.json(enrichedAnalyses);
  } catch (error) {
    console.error("Failed to fetch T&C analyses:", error);
    res.status(500).json({ message: "Failed to fetch T&C analyses" });
  }
});

/**
 * @swagger
 * /api/tc-legal/{id}:
 *   get:
 *     summary: Get T&C analysis by ID
 *     tags: [T&C Legal Analysis]
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
 *         description: Analysis retrieved successfully
 *       404:
 *         description: Analysis not found
 */
router.get("/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const analysis = await storage.getTcLegalAnalysisById(req.user!.tenantId, req.params.id);

    if (!analysis) {
      return res.status(404).json({ message: "Analysis not found" });
    }

    // Get app info
    const app = await storage.getSaasAppById(req.user!.tenantId, analysis.appId);

    res.json({
      ...analysis,
      app,
    });
  } catch (error) {
    console.error("Failed to fetch T&C analysis:", error);
    res.status(500).json({ message: "Failed to fetch T&C analysis" });
  }
});

/**
 * @swagger
 * /api/tc-legal/app/{appId}:
 *   get:
 *     summary: Get latest T&C analysis for an app
 *     tags: [T&C Legal Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Analysis retrieved successfully
 *       404:
 *         description: No analysis found for app
 */
router.get("/app/:appId", authenticateToken, async (req: Request, res: Response) => {
  try {
    const analysis = await storage.getLatestTcLegalAnalysis(req.user!.tenantId, req.params.appId);

    if (!analysis) {
      return res.status(404).json({ message: "No T&C analysis found for this app" });
    }

    res.json(analysis);
  } catch (error) {
    console.error("Failed to fetch T&C analysis:", error);
    res.status(500).json({ message: "Failed to fetch T&C analysis" });
  }
});

/**
 * @swagger
 * /api/tc-legal/{id}/approve:
 *   put:
 *     summary: Update approval status for T&C analysis
 *     tags: [T&C Legal Analysis]
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
 *             properties:
 *               approvalStatus:
 *                 type: string
 *                 enum: [pending, approved, rejected, needs_review]
 *               reviewNotes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Approval status updated
 *       404:
 *         description: Analysis not found
 */
router.put("/:id/approve", authenticateToken, requireRole(["admin", "it-manager"]), async (req: Request, res: Response) => {
  try {
    const validatedData = updateApprovalSchema.parse(req.body);

    const analysis = await storage.getTcLegalAnalysisById(req.user!.tenantId, req.params.id);
    if (!analysis) {
      return res.status(404).json({ message: "Analysis not found" });
    }

    const updated = await storage.updateTcLegalAnalysis(req.user!.tenantId, req.params.id, {
      approvalStatus: validatedData.approvalStatus,
      reviewNotes: validatedData.reviewNotes,
      reviewedBy: req.user!.id,
      reviewedAt: new Date(),
    });

    // Audit log
    auditLogger.log({
      tenantId: req.user!.tenantId,
      userId: req.user!.id,
      action: AuditActions.UPDATE,
      resourceType: 'tc_legal_analysis' as ResourceTypes,
      resourceId: req.params.id,
      details: {
        appId: analysis.appId,
        newStatus: validatedData.approvalStatus,
        reviewNotes: validatedData.reviewNotes,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("Failed to update approval status:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid request", errors: error.errors });
    }

    res.status(500).json({ message: "Failed to update approval status" });
  }
});

/**
 * @swagger
 * /api/tc-legal/{id}/re-analyze:
 *   post:
 *     summary: Re-analyze T&C (e.g., after document change)
 *     tags: [T&C Legal Analysis]
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
 *         description: Re-analysis completed
 *       404:
 *         description: Analysis not found
 */
router.post("/:id/re-analyze", authenticateToken, requireRole(["admin", "it-manager"]), async (req: Request, res: Response) => {
  try {
    const existingAnalysis = await storage.getTcLegalAnalysisById(req.user!.tenantId, req.params.id);
    if (!existingAnalysis) {
      return res.status(404).json({ message: "Analysis not found" });
    }

    const primaryUrl = existingAnalysis.termsUrl || existingAnalysis.privacyPolicyUrl || existingAnalysis.eulaUrl;
    if (!primaryUrl) {
      return res.status(400).json({ message: "No URL available for re-analysis" });
    }

    // Re-run the analysis
    const analyzer = new TcLegalAnalyzer(req.user!.tenantId, { requireIndiaCompliance: true });
    const newAnalysis = await analyzer.analyzeFromUrl(primaryUrl);

    // Update the existing record
    const updated = await storage.updateTcLegalAnalysis(req.user!.tenantId, req.params.id, {
      documentHash: newAnalysis.documentHash,
      overallRiskScore: newAnalysis.overallRiskScore,
      riskLevel: newAnalysis.riskLevel,
      dataResidency: newAnalysis.dataResidency,
      dataResidencyCompliant: newAnalysis.dataResidencyCompliant,
      dataOwnership: newAnalysis.dataOwnership,
      dataRetention: newAnalysis.dataRetention,
      dataDeletion: newAnalysis.dataDeletion,
      dataPortability: newAnalysis.dataPortability,
      subprocessorsAllowed: newAnalysis.subprocessorsAllowed,
      subprocessorsList: newAnalysis.subprocessorsList,
      thirdPartySharing: newAnalysis.thirdPartySharing,
      securityCertifications: newAnalysis.securityCertifications,
      encryptionClaims: newAnalysis.encryptionClaims,
      breachNotificationDays: newAnalysis.breachNotificationDays,
      governingLaw: newAnalysis.governingLaw,
      disputeResolution: newAnalysis.disputeResolution,
      liabilityLimitation: newAnalysis.liabilityLimitation,
      indemnification: newAnalysis.indemnification,
      terminationRights: newAnalysis.terminationRights,
      terminationNoticeDays: newAnalysis.terminationNoticeDays,
      dataExportOnTermination: newAnalysis.dataExportOnTermination,
      ipOwnership: newAnalysis.ipOwnership,
      confidentialityTerms: newAnalysis.confidentialityTerms,
      uptimeGuarantee: newAnalysis.uptimeGuarantee,
      slaPenalties: newAnalysis.slaPenalties,
      supportTerms: newAnalysis.supportTerms,
      autoRenewalClause: newAnalysis.autoRenewalClause,
      priceChangeNotice: newAnalysis.priceChangeNotice,
      aiDataUsage: newAnalysis.aiDataUsage,
      aiOptOut: newAnalysis.aiOptOut,
      gdprCompliant: newAnalysis.gdprCompliant,
      dpdpCompliant: newAnalysis.dpdpCompliant,
      hipaaCompliant: newAnalysis.hipaaCompliant,
      soc2Compliant: newAnalysis.soc2Compliant,
      riskFlags: newAnalysis.riskFlags,
      regulatoryMapping: newAnalysis.regulatoryMapping,
      keyClauses: newAnalysis.keyClauses,
      executiveSummary: newAnalysis.executiveSummary,
      recommendations: newAnalysis.recommendations,
      confidenceScore: newAnalysis.confidenceScore,
      manualReviewRequired: newAnalysis.manualReviewRequired,
      approvalStatus: newAnalysis.manualReviewRequired ? "needs_review" : "pending",
    });

    // Audit log
    auditLogger.log({
      tenantId: req.user!.tenantId,
      userId: req.user!.id,
      action: AuditActions.UPDATE,
      resourceType: 'tc_legal_analysis' as ResourceTypes,
      resourceId: req.params.id,
      details: {
        action: 're-analyze',
        appId: existingAnalysis.appId,
        newRiskScore: newAnalysis.overallRiskScore,
        documentHashChanged: existingAnalysis.documentHash !== newAnalysis.documentHash,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("Re-analysis failed:", error);
    res.status(500).json({
      message: "Re-analysis failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * @swagger
 * /api/tc-legal/stats:
 *   get:
 *     summary: Get T&C analysis statistics
 *     tags: [T&C Legal Analysis]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
router.get("/stats/summary", authenticateToken, async (req: Request, res: Response) => {
  try {
    const analyses = await storage.getTcLegalAnalyses(req.user!.tenantId, {});

    const stats = {
      total: analyses.length,
      byRiskLevel: {
        critical: analyses.filter(a => a.riskLevel === 'critical').length,
        high: analyses.filter(a => a.riskLevel === 'high').length,
        medium: analyses.filter(a => a.riskLevel === 'medium').length,
        low: analyses.filter(a => a.riskLevel === 'low').length,
        unknown: analyses.filter(a => a.riskLevel === 'unknown').length,
      },
      byApprovalStatus: {
        pending: analyses.filter(a => a.approvalStatus === 'pending').length,
        approved: analyses.filter(a => a.approvalStatus === 'approved').length,
        rejected: analyses.filter(a => a.approvalStatus === 'rejected').length,
        needs_review: analyses.filter(a => a.approvalStatus === 'needs_review').length,
      },
      avgRiskScore: analyses.length > 0
        ? Math.round(analyses.reduce((sum, a) => sum + (a.overallRiskScore || 0), 0) / analyses.length)
        : 0,
      dataResidencyIssues: analyses.filter(a => a.dataResidencyCompliant === false).length,
      manualReviewRequired: analyses.filter(a => a.manualReviewRequired).length,
    };

    res.json(stats);
  } catch (error) {
    console.error("Failed to fetch T&C stats:", error);
    res.status(500).json({ message: "Failed to fetch statistics" });
  }
});

/**
 * @swagger
 * /api/tc-legal/{id}:
 *   delete:
 *     summary: Delete T&C analysis
 *     tags: [T&C Legal Analysis]
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
 *         description: Analysis deleted successfully
 *       404:
 *         description: Analysis not found
 */
router.delete("/:id", authenticateToken, requireRole(["admin"]), async (req: Request, res: Response) => {
  try {
    const analysis = await storage.getTcLegalAnalysisById(req.user!.tenantId, req.params.id);
    if (!analysis) {
      return res.status(404).json({ message: "Analysis not found" });
    }

    await storage.deleteTcLegalAnalysis(req.user!.tenantId, req.params.id);

    // Audit log
    auditLogger.log({
      tenantId: req.user!.tenantId,
      userId: req.user!.id,
      action: AuditActions.DELETE,
      resourceType: 'tc_legal_analysis' as ResourceTypes,
      resourceId: req.params.id,
      details: {
        appId: analysis.appId,
      },
    });

    res.json({ message: "Analysis deleted successfully" });
  } catch (error) {
    console.error("Failed to delete T&C analysis:", error);
    res.status(500).json({ message: "Failed to delete analysis" });
  }
});

export default router;
