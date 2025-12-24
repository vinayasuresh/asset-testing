/**
 * Reports API Routes
 *
 * Endpoints for generating and exporting audit reports
 */

import { Router, Request, Response } from "express";
import { authenticateToken, requireRole } from "../middleware/auth.middleware";
import { auditLogger, AuditActions, ResourceTypes } from "../audit-logger";
import { AuditReportGenerator, ReportType, ReportConfig } from "../services/reports/audit-report-generator";
import { ReportExporter, ExportFormat, ExportOptions } from "../services/reports/report-exporter";

const router = Router();

/**
 * @swagger
 * /api/reports/types:
 *   get:
 *     summary: Get available report types
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of available report types
 */
router.get("/types", authenticateToken, async (req: Request, res: Response) => {
  try {
    const reportTypes = [
      {
        type: 'security_audit',
        name: 'Security Audit Report',
        description: 'Comprehensive security posture assessment including app risks, OAuth grants, and MFA/SSO coverage',
        category: 'Security'
      },
      {
        type: 'compliance_audit',
        name: 'Compliance Audit Report',
        description: 'Compliance status assessment including DPAs, data residency, and regulatory requirements',
        category: 'Compliance'
      },
      {
        type: 'access_review',
        name: 'Access Review Report',
        description: 'User access analysis including dormant access, privileged users, and access patterns',
        category: 'Identity'
      },
      {
        type: 'license_usage',
        name: 'License Usage Report',
        description: 'License utilization analysis with waste identification and cost optimization opportunities',
        category: 'Cost'
      },
      {
        type: 'cost_analysis',
        name: 'Cost Analysis Report',
        description: 'SaaS spending breakdown by vendor, category, and application',
        category: 'Cost'
      },
      {
        type: 'vendor_risk',
        name: 'Vendor Risk Report',
        description: 'Risk assessment of all vendors including breach history and concentration risk',
        category: 'Risk'
      },
      {
        type: 'user_activity',
        name: 'User Activity Report',
        description: 'User activity patterns and application usage statistics',
        category: 'Identity'
      },
      {
        type: 'shadow_it',
        name: 'Shadow IT Report',
        description: 'Detection and analysis of unsanctioned applications',
        category: 'Security'
      },
      {
        type: 'executive_summary',
        name: 'Executive Summary',
        description: 'High-level overview combining security, compliance, and cost metrics',
        category: 'Executive'
      }
    ];

    res.json(reportTypes);
  } catch (error: any) {
    console.error('Failed to get report types:', error);
    res.status(500).json({ message: error.message || "Failed to get report types" });
  }
});

/**
 * @swagger
 * /api/reports/generate:
 *   post:
 *     summary: Generate a report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [security_audit, compliance_audit, access_review, license_usage, cost_analysis, vendor_risk, user_activity, shadow_it, executive_summary]
 *               title:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               filters:
 *                 type: object
 *               includeRawData:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Report generated successfully
 */
router.post("/generate", authenticateToken, async (req: Request, res: Response) => {
  try {
    const {
      type,
      title,
      startDate,
      endDate,
      filters,
      includeRawData
    } = req.body;

    if (!type) {
      return res.status(400).json({ message: "Report type is required" });
    }

    const validTypes: ReportType[] = [
      'security_audit', 'compliance_audit', 'access_review',
      'license_usage', 'cost_analysis', 'vendor_risk',
      'user_activity', 'shadow_it', 'executive_summary'
    ];

    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: "Invalid report type" });
    }

    const config: ReportConfig = {
      type: type as ReportType,
      title: title || `${type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Report`,
      dateRange: {
        start: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate) : new Date()
      },
      filters,
      includeRawData: includeRawData || false
    };

    const generator = new AuditReportGenerator(req.user!.tenantId);
    const report = await generator.generateReport(config, req.user!.email);

    // Audit log
    await auditLogger.logActivity(
      auditLogger.createUserContext(req),
      {
        action: AuditActions.CREATE,
        resourceType: ResourceTypes.REPORT,
        resourceId: report.id,
        description: `Generated ${type} report: ${report.title}`
      },
      req
    );

    res.json(report);
  } catch (error: any) {
    console.error('Failed to generate report:', error);
    res.status(500).json({ message: error.message || "Failed to generate report" });
  }
});

/**
 * @swagger
 * /api/reports/export:
 *   post:
 *     summary: Generate and export a report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - format
 *             properties:
 *               type:
 *                 type: string
 *               format:
 *                 type: string
 *                 enum: [pdf, csv, xlsx, html, json]
 *               title:
 *                 type: string
 *               startDate:
 *                 type: string
 *               endDate:
 *                 type: string
 *               includeSummary:
 *                 type: boolean
 *               includeRawData:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Report exported successfully
 */
router.post("/export", authenticateToken, async (req: Request, res: Response) => {
  try {
    const {
      type,
      format,
      title,
      startDate,
      endDate,
      filters,
      includeSummary,
      includeRawData,
      branding
    } = req.body;

    if (!type || !format) {
      return res.status(400).json({ message: "Report type and format are required" });
    }

    const validFormats: ExportFormat[] = ['pdf', 'csv', 'xlsx', 'html', 'json'];
    if (!validFormats.includes(format)) {
      return res.status(400).json({ message: "Invalid export format" });
    }

    // Generate report
    const config: ReportConfig = {
      type: type as ReportType,
      title: title || `${type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Report`,
      dateRange: {
        start: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate) : new Date()
      },
      filters,
      includeRawData: includeRawData || false
    };

    const generator = new AuditReportGenerator(req.user!.tenantId);
    const report = await generator.generateReport(config, req.user!.email);

    // Export report
    const exportOptions: ExportOptions = {
      format: format as ExportFormat,
      includeSummary: includeSummary !== false,
      includeRawData: includeRawData || false,
      branding
    };

    const exporter = new ReportExporter();
    const result = await exporter.export(report, exportOptions);

    // Audit log
    await auditLogger.logActivity(
      auditLogger.createUserContext(req),
      {
        action: AuditActions.EXPORT,
        resourceType: ResourceTypes.REPORT,
        resourceId: report.id,
        description: `Exported ${type} report as ${format}: ${result.filename}`
      },
      req
    );

    // Set headers and send file
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.size);
    res.send(result.data);
  } catch (error: any) {
    console.error('Failed to export report:', error);
    res.status(500).json({ message: error.message || "Failed to export report" });
  }
});

/**
 * @swagger
 * /api/reports/scheduled:
 *   get:
 *     summary: Get scheduled reports
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Scheduled reports retrieved
 */
router.get("/scheduled", authenticateToken, async (req: Request, res: Response) => {
  try {
    // Return scheduled reports configuration
    // In production, fetch from database
    res.json([
      {
        id: 'sched_1',
        name: 'Weekly Security Report',
        type: 'security_audit',
        format: 'pdf',
        schedule: 'weekly',
        dayOfWeek: 1,
        recipients: ['security@company.com'],
        enabled: true
      },
      {
        id: 'sched_2',
        name: 'Monthly Executive Summary',
        type: 'executive_summary',
        format: 'pdf',
        schedule: 'monthly',
        dayOfMonth: 1,
        recipients: ['cfo@company.com', 'cio@company.com'],
        enabled: true
      },
      {
        id: 'sched_3',
        name: 'Quarterly Compliance Report',
        type: 'compliance_audit',
        format: 'pdf',
        schedule: 'quarterly',
        recipients: ['compliance@company.com'],
        enabled: true
      }
    ]);
  } catch (error: any) {
    console.error('Failed to get scheduled reports:', error);
    res.status(500).json({ message: error.message || "Failed to get scheduled reports" });
  }
});

/**
 * @swagger
 * /api/reports/scheduled:
 *   post:
 *     summary: Create a scheduled report
 *     tags: [Reports]
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
 *               - type
 *               - format
 *               - schedule
 *               - recipients
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *               format:
 *                 type: string
 *               schedule:
 *                 type: string
 *                 enum: [daily, weekly, monthly, quarterly]
 *               dayOfWeek:
 *                 type: number
 *               dayOfMonth:
 *                 type: number
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: string
 *               enabled:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Scheduled report created
 */
router.post("/scheduled", authenticateToken, requireRole("it-manager"), async (req: Request, res: Response) => {
  try {
    const {
      name,
      type,
      format,
      schedule,
      dayOfWeek,
      dayOfMonth,
      recipients,
      enabled
    } = req.body;

    if (!name || !type || !format || !schedule || !recipients) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // In production, save to database
    const scheduledReport = {
      id: `sched_${Date.now()}`,
      name,
      type,
      format,
      schedule,
      dayOfWeek,
      dayOfMonth,
      recipients,
      enabled: enabled !== false,
      createdAt: new Date(),
      createdBy: req.user!.email
    };

    // Audit log
    await auditLogger.logActivity(
      auditLogger.createUserContext(req),
      {
        action: AuditActions.CREATE,
        resourceType: ResourceTypes.REPORT,
        resourceId: scheduledReport.id,
        description: `Created scheduled report: ${name}`
      },
      req
    );

    res.status(201).json(scheduledReport);
  } catch (error: any) {
    console.error('Failed to create scheduled report:', error);
    res.status(500).json({ message: error.message || "Failed to create scheduled report" });
  }
});

/**
 * @swagger
 * /api/reports/quick/{type}:
 *   get:
 *     summary: Generate a quick report (last 30 days)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, pdf, csv, xlsx]
 *           default: json
 *     responses:
 *       200:
 *         description: Report generated
 */
router.get("/quick/:type", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const format = (req.query.format as string) || 'json';

    const config: ReportConfig = {
      type: type as ReportType,
      title: `Quick ${type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Report`,
      dateRange: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      },
      includeRawData: false
    };

    const generator = new AuditReportGenerator(req.user!.tenantId);
    const report = await generator.generateReport(config, req.user!.email);

    if (format === 'json') {
      res.json(report);
    } else {
      const exporter = new ReportExporter();
      const result = await exporter.export(report, {
        format: format as ExportFormat,
        includeSummary: true
      });

      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.data);
    }
  } catch (error: any) {
    console.error('Failed to generate quick report:', error);
    res.status(500).json({ message: error.message || "Failed to generate quick report" });
  }
});

export default router;
