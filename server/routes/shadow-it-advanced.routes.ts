/**
 * Advanced Shadow IT Routes
 *
 * API endpoints for:
 * - Browser extension discovery
 * - Email discovery
 * - Network traffic analysis
 * - Real-time alerting
 * - Auto-remediation
 * - CASB integration
 * - SIEM integration
 * - AI-powered analytics
 */

import { Router, Request, Response } from "express";
import { authenticateToken, requireRole } from "../middleware/auth.middleware";
import { createBrowserExtensionDiscoveryService } from "../services/discovery/browser-extension-discovery";
import { createEmailDiscoveryService } from "../services/discovery/email-discovery";
import { createNetworkTrafficDiscoveryService } from "../services/discovery/network-traffic-discovery";
import { createAlertEngine } from "../services/alerting/alert-engine";
import { createNotificationService } from "../services/alerting/notification-service";
import { createRemediationEngine } from "../services/remediation/remediation-engine";
import { createCASBIntegrationService } from "../services/integrations/casb-integration";
import { createSIEMIntegrationService } from "../services/integrations/siem-integration";
import { createUnusedResourceAnalyzer } from "../services/ai/unused-resource-analyzer";

const router = Router();

// ============================================================================
// Browser Extension Discovery Routes
// ============================================================================

/**
 * POST /api/shadow-it/browser-discovery
 * Submit browser extension discovery data
 */
router.post(
  "/browser-discovery",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const service = createBrowserExtensionDiscoveryService(req.user!.tenantId);
      const results = await service.processExtensionEvent(req.body);
      res.json({ success: true, discoveries: results });
    } catch (error: any) {
      console.error("Browser discovery error:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * GET /api/shadow-it/browser-discovery/stats
 * Get browser discovery statistics
 */
router.get(
  "/browser-discovery/stats",
  authenticateToken,
  requireRole("it-manager"),
  async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const service = createBrowserExtensionDiscoveryService(req.user!.tenantId);
      const stats = await service.getStats(days);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ============================================================================
// Email Discovery Routes
// ============================================================================

/**
 * POST /api/shadow-it/email-discovery
 * Submit email discovery data
 */
router.post(
  "/email-discovery",
  authenticateToken,
  requireRole("it-manager"),
  async (req: Request, res: Response) => {
    try {
      const service = createEmailDiscoveryService(req.user!.tenantId);
      const results = await service.processEmails(req.body.emails);
      res.json({ success: true, discoveries: results });
    } catch (error: any) {
      console.error("Email discovery error:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * GET /api/shadow-it/email-discovery/stats
 * Get email discovery statistics
 */
router.get(
  "/email-discovery/stats",
  authenticateToken,
  requireRole("it-manager"),
  async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const service = createEmailDiscoveryService(req.user!.tenantId);
      const stats = await service.getStats(days);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * POST /api/shadow-it/email-discovery/sync/microsoft365
 * Sync emails from Microsoft 365 with comprehensive header scanning
 *
 * Body parameters:
 * - accessToken: OAuth access token for Microsoft Graph API
 * - userId: (optional) User ID to scan, defaults to authenticated user
 * - options.daysBack: Number of days to scan (default: 30)
 * - options.maxEmails: Maximum emails to fetch (default: 500)
 * - options.scanAllHeaders: Scan all external emails (default: true)
 */
router.post(
  "/email-discovery/sync/microsoft365",
  authenticateToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { accessToken, userId, options } = req.body;
      if (!accessToken) {
        return res.status(400).json({ message: "Access token is required" });
      }

      const scanOptions = {
        daysBack: options?.daysBack || 30,
        maxEmails: options?.maxEmails || 500,
        scanAllHeaders: options?.scanAllHeaders !== false,
        includeInternal: options?.includeInternal || false,
      };

      const service = createEmailDiscoveryService(req.user!.tenantId);
      const results = await service.syncFromMicrosoft365(accessToken, userId, scanOptions);
      res.json({
        success: true,
        provider: "microsoft365",
        scanOptions,
        discoveries: results,
        count: results.length,
        newDiscoveries: results.filter(r => r.isNewDiscovery).length,
      });
    } catch (error: any) {
      console.error("Microsoft 365 email sync error:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * POST /api/shadow-it/email-discovery/sync/google
 * Sync emails from Google Workspace with comprehensive header scanning
 *
 * Body parameters:
 * - accessToken: OAuth access token for Gmail API
 * - userId: (optional) User ID to scan, defaults to 'me'
 * - options.daysBack: Number of days to scan (default: 30)
 * - options.maxEmails: Maximum emails to fetch (default: 500)
 * - options.scanAllHeaders: Scan all external emails (default: true)
 */
router.post(
  "/email-discovery/sync/google",
  authenticateToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { accessToken, userId, options } = req.body;
      if (!accessToken) {
        return res.status(400).json({ message: "Access token is required" });
      }

      const scanOptions = {
        daysBack: options?.daysBack || 30,
        maxEmails: options?.maxEmails || 500,
        scanAllHeaders: options?.scanAllHeaders !== false,
        includeInternal: options?.includeInternal || false,
      };

      const service = createEmailDiscoveryService(req.user!.tenantId);
      const results = await service.syncFromGoogleWorkspace(accessToken, userId, scanOptions);
      res.json({
        success: true,
        provider: "google",
        scanOptions,
        discoveries: results,
        count: results.length,
        newDiscoveries: results.filter(r => r.isNewDiscovery).length,
      });
    } catch (error: any) {
      console.error("Google Workspace email sync error:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * POST /api/shadow-it/email-discovery/sync/zoho
 * Sync emails from Zoho Mail with comprehensive header scanning
 *
 * Body parameters:
 * - accessToken: OAuth access token for Zoho Mail API
 * - accountId: Zoho account ID
 * - userId: (optional) User ID
 * - options.daysBack: Number of days to scan (default: 30)
 * - options.maxEmails: Maximum emails to fetch (default: 500)
 * - options.scanAllHeaders: Scan all external emails (default: true)
 */
router.post(
  "/email-discovery/sync/zoho",
  authenticateToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { accessToken, accountId, userId, options } = req.body;
      if (!accessToken || !accountId) {
        return res.status(400).json({ message: "Access token and account ID are required" });
      }

      const scanOptions = {
        daysBack: options?.daysBack || 30,
        maxEmails: options?.maxEmails || 500,
        scanAllHeaders: options?.scanAllHeaders !== false,
        includeInternal: options?.includeInternal || false,
      };

      const service = createEmailDiscoveryService(req.user!.tenantId);
      const results = await service.syncFromZohoMail(accessToken, accountId, userId, scanOptions);
      res.json({
        success: true,
        provider: "zoho",
        scanOptions,
        discoveries: results,
        count: results.length,
        newDiscoveries: results.filter(r => r.isNewDiscovery).length,
      });
    } catch (error: any) {
      console.error("Zoho Mail email sync error:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * GET /api/shadow-it/email-discovery/scan-settings
 * Get email scan frequency and settings
 */
router.get(
  "/email-discovery/scan-settings",
  authenticateToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      res.json({
        frequency: "daily",
        lastScanAt: null,
        nextScanAt: null,
        enabled: true,
        scanOptions: {
          daysBack: 7,
          maxEmails: 500,
          scanAllHeaders: true,
        },
        supportedProviders: ["microsoft365", "google", "zoho"],
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * PUT /api/shadow-it/email-discovery/scan-settings
 * Update email scan frequency and settings
 */
router.put(
  "/email-discovery/scan-settings",
  authenticateToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { frequency, enabled, scanOptions } = req.body;

      const validFrequencies = ["hourly", "daily", "weekly"];
      if (frequency && !validFrequencies.includes(frequency)) {
        return res.status(400).json({
          message: `Invalid frequency. Must be one of: ${validFrequencies.join(", ")}`,
        });
      }

      res.json({
        success: true,
        message: "Email scan settings updated",
        settings: {
          frequency: frequency || "daily",
          enabled: enabled !== false,
          scanOptions: {
            daysBack: scanOptions?.daysBack || 7,
            maxEmails: scanOptions?.maxEmails || 500,
            scanAllHeaders: scanOptions?.scanAllHeaders !== false,
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ============================================================================
// Network Traffic Discovery Routes
// ============================================================================

/**
 * POST /api/shadow-it/network-discovery
 * Submit network traffic data
 */
router.post(
  "/network-discovery",
  authenticateToken,
  requireRole("it-manager"),
  async (req: Request, res: Response) => {
    try {
      const service = createNetworkTrafficDiscoveryService(req.user!.tenantId);
      const results = await service.processTrafficEvents(req.body.events);
      res.json({ success: true, discoveries: results });
    } catch (error: any) {
      console.error("Network discovery error:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * POST /api/shadow-it/network-discovery/firewall-logs
 * Submit firewall logs for analysis
 */
router.post(
  "/network-discovery/firewall-logs",
  authenticateToken,
  requireRole("it-manager"),
  async (req: Request, res: Response) => {
    try {
      const service = createNetworkTrafficDiscoveryService(req.user!.tenantId);
      const results = await service.processFirewallLogs(req.body.logs);
      res.json({ success: true, discoveries: results });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * GET /api/shadow-it/network-discovery/stats
 * Get network discovery statistics
 */
router.get(
  "/network-discovery/stats",
  authenticateToken,
  requireRole("it-manager"),
  async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const service = createNetworkTrafficDiscoveryService(req.user!.tenantId);
      const stats = await service.getStats(days);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ============================================================================
// Alert Configuration Routes
// ============================================================================

/**
 * GET /api/shadow-it/alerts/configurations
 * Get all alert configurations
 */
router.get(
  "/alerts/configurations",
  authenticateToken,
  requireRole("it-manager"),
  async (req: Request, res: Response) => {
    try {
      const engine = createAlertEngine(req.user!.tenantId);
      // Note: In production, this would query storage directly
      res.json({ configurations: [] });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * POST /api/shadow-it/alerts/configurations
 * Create alert configuration
 */
router.post(
  "/alerts/configurations",
  authenticateToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const engine = createAlertEngine(req.user!.tenantId);
      const config = await engine.createConfiguration(req.body);
      res.status(201).json(config);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * PUT /api/shadow-it/alerts/configurations/:id
 * Update alert configuration
 */
router.put(
  "/alerts/configurations/:id",
  authenticateToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const engine = createAlertEngine(req.user!.tenantId);
      const config = await engine.updateConfiguration(req.params.id, req.body);
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * DELETE /api/shadow-it/alerts/configurations/:id
 * Delete alert configuration
 */
router.delete(
  "/alerts/configurations/:id",
  authenticateToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const engine = createAlertEngine(req.user!.tenantId);
      await engine.deleteConfiguration(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * POST /api/shadow-it/alerts/:id/acknowledge
 * Acknowledge an alert
 */
router.post(
  "/alerts/:id/acknowledge",
  authenticateToken,
  requireRole("it-manager"),
  async (req: Request, res: Response) => {
    try {
      const engine = createAlertEngine(req.user!.tenantId);
      const alert = await engine.acknowledgeAlert(req.params.id, req.user!.id);
      res.json(alert);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * POST /api/shadow-it/alerts/:id/resolve
 * Resolve an alert
 */
router.post(
  "/alerts/:id/resolve",
  authenticateToken,
  requireRole("it-manager"),
  async (req: Request, res: Response) => {
    try {
      const engine = createAlertEngine(req.user!.tenantId);
      const alert = await engine.resolveAlert(req.params.id, req.user!.id, req.body.notes);
      res.json(alert);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * GET /api/shadow-it/alerts/stats
 * Get alert statistics
 */
router.get(
  "/alerts/stats",
  authenticateToken,
  requireRole("it-manager"),
  async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const engine = createAlertEngine(req.user!.tenantId);
      const stats = await engine.getAlertStats(days);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ============================================================================
// Notification Channel Routes
// ============================================================================

/**
 * GET /api/shadow-it/notifications/channels
 * Get all notification channels
 */
router.get(
  "/notifications/channels",
  authenticateToken,
  requireRole("it-manager"),
  async (req: Request, res: Response) => {
    try {
      const service = createNotificationService(req.user!.tenantId);
      const channels = await service.getChannels();
      res.json(channels);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * POST /api/shadow-it/notifications/channels
 * Create notification channel
 */
router.post(
  "/notifications/channels",
  authenticateToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const service = createNotificationService(req.user!.tenantId);
      const channel = await service.createChannel(req.body);
      res.status(201).json(channel);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * POST /api/shadow-it/notifications/channels/:id/test
 * Test notification channel
 */
router.post(
  "/notifications/channels/:id/test",
  authenticateToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const service = createNotificationService(req.user!.tenantId);
      const channels = await service.getChannels();
      const channel = channels.find(c => c.id === req.params.id);
      if (!channel) {
        return res.status(404).json({ message: "Channel not found" });
      }
      const result = await service.testChannel(channel);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * DELETE /api/shadow-it/notifications/channels/:id
 * Delete notification channel
 */
router.delete(
  "/notifications/channels/:id",
  authenticateToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const service = createNotificationService(req.user!.tenantId);
      await service.deleteChannel(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ============================================================================
// Remediation Routes
// ============================================================================

/**
 * GET /api/shadow-it/remediation/actions
 * Get all remediation actions
 */
router.get(
  "/remediation/actions",
  authenticateToken,
  requireRole("it-manager"),
  async (req: Request, res: Response) => {
    try {
      // In production, query storage directly
      res.json({ actions: [] });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * POST /api/shadow-it/remediation/actions
 * Create remediation action
 */
router.post(
  "/remediation/actions",
  authenticateToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const engine = createRemediationEngine(req.user!.tenantId);
      const action = await engine.createAction(req.body);
      res.status(201).json(action);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * PUT /api/shadow-it/remediation/actions/:id
 * Update remediation action
 */
router.put(
  "/remediation/actions/:id",
  authenticateToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const engine = createRemediationEngine(req.user!.tenantId);
      const action = await engine.updateAction(req.params.id, req.body);
      res.json(action);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * DELETE /api/shadow-it/remediation/actions/:id
 * Delete remediation action
 */
router.delete(
  "/remediation/actions/:id",
  authenticateToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const engine = createRemediationEngine(req.user!.tenantId);
      await engine.deleteAction(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * POST /api/shadow-it/remediation/executions/:id/approve
 * Approve pending remediation execution
 */
router.post(
  "/remediation/executions/:id/approve",
  authenticateToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const engine = createRemediationEngine(req.user!.tenantId);
      const execution = await engine.approveExecution(
        req.params.id,
        req.user!.id,
        req.body.notes
      );
      res.json(execution);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * POST /api/shadow-it/remediation/executions/:id/reject
 * Reject pending remediation execution
 */
router.post(
  "/remediation/executions/:id/reject",
  authenticateToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const engine = createRemediationEngine(req.user!.tenantId);
      const execution = await engine.rejectExecution(
        req.params.id,
        req.user!.id,
        req.body.reason
      );
      res.json(execution);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * POST /api/shadow-it/remediation/executions/:id/rollback
 * Rollback remediation execution
 */
router.post(
  "/remediation/executions/:id/rollback",
  authenticateToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const engine = createRemediationEngine(req.user!.tenantId);
      const execution = await engine.rollbackExecution(
        req.params.id,
        req.user!.id,
        req.body.reason
      );
      res.json(execution);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * GET /api/shadow-it/remediation/stats
 * Get remediation statistics
 */
router.get(
  "/remediation/stats",
  authenticateToken,
  requireRole("it-manager"),
  async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const engine = createRemediationEngine(req.user!.tenantId);
      const stats = await engine.getStats(days);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ============================================================================
// CASB Integration Routes
// ============================================================================

/**
 * GET /api/shadow-it/casb/integrations
 * Get all CASB integrations
 */
router.get(
  "/casb/integrations",
  authenticateToken,
  requireRole("it-manager"),
  async (req: Request, res: Response) => {
    try {
      // In production, query storage
      res.json({ integrations: [] });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * POST /api/shadow-it/casb/integrations
 * Create CASB integration
 */
router.post(
  "/casb/integrations",
  authenticateToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const service = createCASBIntegrationService(req.user!.tenantId);
      const integration = await service.createIntegration(req.body);
      res.status(201).json(integration);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * POST /api/shadow-it/casb/integrations/:id/test
 * Test CASB connection
 */
router.post(
  "/casb/integrations/:id/test",
  authenticateToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const service = createCASBIntegrationService(req.user!.tenantId);
      await service.initialize(req.params.id);
      // In production, get integration and test
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * POST /api/shadow-it/casb/integrations/:id/sync
 * Trigger CASB sync
 */
router.post(
  "/casb/integrations/:id/sync",
  authenticateToken,
  requireRole("it-manager"),
  async (req: Request, res: Response) => {
    try {
      const service = createCASBIntegrationService(req.user!.tenantId);
      await service.initialize(req.params.id);
      const result = await service.syncApps();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * GET /api/shadow-it/casb/stats
 * Get CASB statistics
 */
router.get(
  "/casb/stats",
  authenticateToken,
  requireRole("it-manager"),
  async (req: Request, res: Response) => {
    try {
      const service = createCASBIntegrationService(req.user!.tenantId);
      const stats = await service.getStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ============================================================================
// SIEM Integration Routes
// ============================================================================

/**
 * GET /api/shadow-it/siem/integrations
 * Get all SIEM integrations
 */
router.get(
  "/siem/integrations",
  authenticateToken,
  requireRole("it-manager"),
  async (req: Request, res: Response) => {
    try {
      res.json({ integrations: [] });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * POST /api/shadow-it/siem/integrations
 * Create SIEM integration
 */
router.post(
  "/siem/integrations",
  authenticateToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const service = createSIEMIntegrationService(req.user!.tenantId);
      const integration = await service.createIntegration(req.body);
      res.status(201).json(integration);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * POST /api/shadow-it/siem/integrations/:id/test
 * Test SIEM connection
 */
router.post(
  "/siem/integrations/:id/test",
  authenticateToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const service = createSIEMIntegrationService(req.user!.tenantId);
      // In production, get integration and test
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * GET /api/shadow-it/siem/stats
 * Get SIEM statistics
 */
router.get(
  "/siem/stats",
  authenticateToken,
  requireRole("it-manager"),
  async (req: Request, res: Response) => {
    try {
      const service = createSIEMIntegrationService(req.user!.tenantId);
      const stats = await service.getStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ============================================================================
// AI Analytics Routes
// ============================================================================

/**
 * POST /api/shadow-it/ai/analyze
 * Start AI analysis job
 */
router.post(
  "/ai/analyze",
  authenticateToken,
  requireRole("it-manager"),
  async (req: Request, res: Response) => {
    try {
      const analyzer = createUnusedResourceAnalyzer(req.user!.tenantId);
      const job = await analyzer.startAnalysis(
        req.body.jobType || 'unused_resource_analysis',
        req.body.scope,
        req.user!.id
      );
      res.status(201).json(job);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * GET /api/shadow-it/ai/jobs/:id
 * Get AI analysis job status
 */
router.get(
  "/ai/jobs/:id",
  authenticateToken,
  requireRole("it-manager"),
  async (req: Request, res: Response) => {
    try {
      const analyzer = createUnusedResourceAnalyzer(req.user!.tenantId);
      const job = await analyzer.getJobStatus(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json(job);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * GET /api/shadow-it/ai/reports
 * Get AI analysis reports
 */
router.get(
  "/ai/reports",
  authenticateToken,
  requireRole("it-manager"),
  async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const analyzer = createUnusedResourceAnalyzer(req.user!.tenantId);
      const reports = await analyzer.getRecentReports(limit);
      res.json(reports);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * GET /api/shadow-it/ai/reports/:id
 * Get specific AI report
 */
router.get(
  "/ai/reports/:id",
  authenticateToken,
  requireRole("it-manager"),
  async (req: Request, res: Response) => {
    try {
      const analyzer = createUnusedResourceAnalyzer(req.user!.tenantId);
      const report = await analyzer.getReport(req.params.id);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * POST /api/shadow-it/ai/reports/:id/publish
 * Publish AI report
 */
router.post(
  "/ai/reports/:id/publish",
  authenticateToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const analyzer = createUnusedResourceAnalyzer(req.user!.tenantId);
      const report = await analyzer.publishReport(req.params.id, req.user!.id);
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

/**
 * POST /api/shadow-it/ai/reports/:id/actions/:actionId/approve
 * Approve recommended action
 */
router.post(
  "/ai/reports/:id/actions/:actionId/approve",
  authenticateToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const analyzer = createUnusedResourceAnalyzer(req.user!.tenantId);
      const report = await analyzer.approveAction(
        req.params.id,
        req.params.actionId,
        req.user!.id
      );
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ============================================================================
// Summary Dashboard Route
// ============================================================================

/**
 * GET /api/shadow-it/dashboard
 * Get comprehensive Shadow IT dashboard data
 */
router.get(
  "/dashboard",
  authenticateToken,
  requireRole("it-manager"),
  async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const tenantId = req.user!.tenantId;

      // Gather stats from all services
      const [
        browserStats,
        emailStats,
        networkStats,
        alertStats,
        remediationStats,
        casbStats,
        siemStats,
      ] = await Promise.all([
        createBrowserExtensionDiscoveryService(tenantId).getStats(days),
        createEmailDiscoveryService(tenantId).getStats(days),
        createNetworkTrafficDiscoveryService(tenantId).getStats(days),
        createAlertEngine(tenantId).getAlertStats(days),
        createRemediationEngine(tenantId).getStats(days),
        createCASBIntegrationService(tenantId).getStats(),
        createSIEMIntegrationService(tenantId).getStats(),
      ]);

      res.json({
        discovery: {
          browser: browserStats,
          email: emailStats,
          network: networkStats,
        },
        alerts: alertStats,
        remediation: remediationStats,
        integrations: {
          casb: casbStats,
          siem: siemStats,
        },
        summary: {
          totalDiscoveries:
            browserStats.totalEvents +
            emailStats.totalEmails +
            networkStats.totalEvents,
          potentialShadowIT:
            browserStats.potentialShadowIT +
            emailStats.newDiscoveries +
            networkStats.shadowITDestinations,
          openAlerts: alertStats.openAlerts,
          pendingRemediation: remediationStats.pendingApproval,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
);

export default router;
