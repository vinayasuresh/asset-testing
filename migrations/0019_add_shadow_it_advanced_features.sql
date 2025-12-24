-- Migration: Advanced Shadow IT Features
-- Adds tables for: Browser Extension Discovery, Email Parsing, Network Traffic Analysis,
-- Real-time Alerting, Auto-Remediation, CASB & SIEM Integrations, AI Analytics

-- ============================================================================
-- 1. Browser Extension Discoveries - Track apps discovered via browser extension
-- ============================================================================
CREATE TABLE IF NOT EXISTS browser_extension_discoveries (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL,

    -- Discovery source
    user_id VARCHAR,
    user_email TEXT,
    device_id VARCHAR,
    extension_version TEXT,
    browser_type TEXT,

    -- Discovered app details
    app_name TEXT NOT NULL,
    app_domain TEXT NOT NULL,
    app_url TEXT,
    favicon_url TEXT,

    -- Usage tracking
    visit_count INTEGER DEFAULT 1,
    first_seen_at TIMESTAMP DEFAULT NOW(),
    last_seen_at TIMESTAMP DEFAULT NOW(),
    time_spent_seconds INTEGER DEFAULT 0,

    -- Classification
    category TEXT,
    is_saas_app BOOLEAN DEFAULT TRUE,
    confidence_score DECIMAL(3,2) DEFAULT 0.5,

    -- Processing status
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP,
    linked_app_id VARCHAR,

    -- Metadata
    metadata JSONB,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Constraints
    UNIQUE (tenant_id, user_id, app_domain)
);

COMMENT ON TABLE browser_extension_discoveries IS 'Apps discovered via browser extension monitoring';
COMMENT ON COLUMN browser_extension_discoveries.confidence_score IS 'ML confidence score 0.0-1.0';
COMMENT ON COLUMN browser_extension_discoveries.browser_type IS 'Values: chrome, firefox, edge, safari';

-- ============================================================================
-- 2. Email Discovery Events - SaaS apps detected from email parsing
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_discovery_events (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL,

    -- Source details
    user_id VARCHAR,
    user_email TEXT NOT NULL,
    email_message_id TEXT,

    -- Email metadata
    sender_email TEXT NOT NULL,
    sender_domain TEXT NOT NULL,
    email_subject TEXT,
    email_date TIMESTAMP,

    -- Discovery type
    discovery_type TEXT NOT NULL,

    -- Extracted app info
    app_name TEXT,
    app_domain TEXT,
    vendor_name TEXT,

    -- Indicators
    is_signup_email BOOLEAN DEFAULT FALSE,
    is_invoice_email BOOLEAN DEFAULT FALSE,
    is_welcome_email BOOLEAN DEFAULT FALSE,
    is_notification_email BOOLEAN DEFAULT FALSE,

    -- Financial extraction (if invoice)
    extracted_amount DECIMAL(12,2),
    extracted_currency TEXT,
    extracted_invoice_number TEXT,

    -- Processing
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP,
    linked_app_id VARCHAR,
    confidence_score DECIMAL(3,2) DEFAULT 0.5,

    -- Metadata
    extracted_data JSONB,
    metadata JSONB,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE email_discovery_events IS 'SaaS apps discovered from email analysis';
COMMENT ON COLUMN email_discovery_events.discovery_type IS 'Values: signup, invoice, welcome, notification, trial, renewal';

-- ============================================================================
-- 3. Network Traffic Events - SaaS detected from network traffic analysis
-- ============================================================================
CREATE TABLE IF NOT EXISTS network_traffic_events (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL,

    -- Source identification
    source_ip TEXT,
    source_device_id VARCHAR,
    source_user_id VARCHAR,
    network_zone TEXT,

    -- Destination
    dest_domain TEXT NOT NULL,
    dest_ip TEXT,
    dest_port INTEGER,

    -- Traffic metadata
    protocol TEXT,
    http_method TEXT,
    request_path TEXT,
    user_agent TEXT,

    -- Traffic volume
    bytes_sent BIGINT DEFAULT 0,
    bytes_received BIGINT DEFAULT 0,
    request_count INTEGER DEFAULT 1,

    -- Classification
    app_name TEXT,
    app_category TEXT,
    is_saas_app BOOLEAN DEFAULT FALSE,
    is_sanctioned BOOLEAN,
    risk_indicators JSONB,

    -- Time window
    first_seen_at TIMESTAMP DEFAULT NOW(),
    last_seen_at TIMESTAMP DEFAULT NOW(),

    -- Processing
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP,
    linked_app_id VARCHAR,

    -- Aggregation key (for deduplication)
    aggregation_key TEXT,

    -- Metadata
    metadata JSONB,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE network_traffic_events IS 'Network traffic events for Shadow IT detection';
COMMENT ON COLUMN network_traffic_events.protocol IS 'Values: http, https, websocket, tcp, udp';
COMMENT ON COLUMN network_traffic_events.network_zone IS 'Values: corporate, vpn, guest, remote';

-- ============================================================================
-- 4. Alert Configurations - Real-time alerting configuration
-- ============================================================================
CREATE TABLE IF NOT EXISTS alert_configurations (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL,

    -- Alert definition
    name TEXT NOT NULL,
    description TEXT,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',

    -- Trigger conditions
    trigger_event TEXT NOT NULL,
    conditions JSONB NOT NULL,
    threshold_value INTEGER,
    threshold_window_minutes INTEGER DEFAULT 60,

    -- Notification channels
    notification_channels JSONB NOT NULL DEFAULT '[]',

    -- Rate limiting
    cooldown_minutes INTEGER DEFAULT 15,
    max_alerts_per_day INTEGER DEFAULT 100,

    -- Status
    enabled BOOLEAN DEFAULT TRUE,

    -- Statistics
    last_triggered_at TIMESTAMP,
    trigger_count INTEGER DEFAULT 0,
    alerts_today INTEGER DEFAULT 0,

    -- Ownership
    created_by VARCHAR,

    -- Metadata
    metadata JSONB,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE alert_configurations IS 'Real-time alert configurations for Shadow IT events';
COMMENT ON COLUMN alert_configurations.alert_type IS 'Values: shadow_it_detected, high_risk_app, oauth_risky_permission, data_exfiltration, policy_violation, compliance_breach';
COMMENT ON COLUMN alert_configurations.severity IS 'Values: low, medium, high, critical';
COMMENT ON COLUMN alert_configurations.trigger_event IS 'Values: app.discovered, oauth.risky_permission, network.anomaly, user.suspicious_activity';

-- ============================================================================
-- 5. Alert Instances - Individual alert occurrences
-- ============================================================================
CREATE TABLE IF NOT EXISTS alert_instances (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL,
    configuration_id VARCHAR NOT NULL,

    -- Alert details
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL,

    -- Trigger context
    trigger_event TEXT NOT NULL,
    trigger_data JSONB NOT NULL,

    -- Related entities
    app_id VARCHAR,
    user_id VARCHAR,
    device_id VARCHAR,

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'open',
    acknowledged_at TIMESTAMP,
    acknowledged_by VARCHAR,
    resolved_at TIMESTAMP,
    resolved_by VARCHAR,
    resolution_notes TEXT,

    -- Notification tracking
    notifications_sent JSONB DEFAULT '[]',

    -- Metadata
    metadata JSONB,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE alert_instances IS 'Individual alert occurrences';
COMMENT ON COLUMN alert_instances.status IS 'Values: open, acknowledged, investigating, resolved, dismissed';

-- ============================================================================
-- 6. Notification Channels - Channel configurations for alerts
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_channels (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL,

    -- Channel details
    name TEXT NOT NULL,
    channel_type TEXT NOT NULL,

    -- Configuration (encrypted at app layer)
    configuration JSONB NOT NULL,

    -- Webhook specific
    webhook_url TEXT,
    webhook_secret TEXT,

    -- Email specific
    email_addresses JSONB,

    -- Slack specific
    slack_webhook_url TEXT,
    slack_channel TEXT,

    -- Teams specific
    teams_webhook_url TEXT,

    -- PagerDuty specific
    pagerduty_routing_key TEXT,

    -- Status
    enabled BOOLEAN DEFAULT TRUE,
    verified BOOLEAN DEFAULT FALSE,
    last_used_at TIMESTAMP,
    failure_count INTEGER DEFAULT 0,

    -- Metadata
    metadata JSONB,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE notification_channels IS 'Notification channel configurations';
COMMENT ON COLUMN notification_channels.channel_type IS 'Values: email, slack, teams, pagerduty, webhook, sms';

-- ============================================================================
-- 7. Remediation Actions - Auto-remediation configurations
-- ============================================================================
CREATE TABLE IF NOT EXISTS remediation_actions (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL,

    -- Action definition
    name TEXT NOT NULL,
    description TEXT,
    action_type TEXT NOT NULL,

    -- Trigger conditions
    trigger_event TEXT NOT NULL,
    conditions JSONB,

    -- Action configuration
    action_config JSONB NOT NULL,

    -- Approval workflow
    requires_approval BOOLEAN DEFAULT FALSE,
    approval_roles JSONB,
    auto_approve_after_minutes INTEGER,

    -- Execution settings
    enabled BOOLEAN DEFAULT TRUE,
    max_executions_per_day INTEGER DEFAULT 50,
    cooldown_minutes INTEGER DEFAULT 5,

    -- Rollback
    supports_rollback BOOLEAN DEFAULT FALSE,
    rollback_config JSONB,

    -- Statistics
    execution_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    last_executed_at TIMESTAMP,

    -- Ownership
    created_by VARCHAR,

    -- Metadata
    metadata JSONB,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE remediation_actions IS 'Auto-remediation action configurations';
COMMENT ON COLUMN remediation_actions.action_type IS 'Values: revoke_oauth_token, block_app, suspend_user_access, notify_manager, quarantine_device, create_ticket, webhook';

-- ============================================================================
-- 8. Remediation Executions - Remediation action execution log
-- ============================================================================
CREATE TABLE IF NOT EXISTS remediation_executions (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL,
    action_id VARCHAR NOT NULL,

    -- Execution context
    trigger_event TEXT NOT NULL,
    trigger_data JSONB NOT NULL,

    -- Target entities
    target_app_id VARCHAR,
    target_user_id VARCHAR,
    target_token_id VARCHAR,
    target_device_id VARCHAR,

    -- Approval workflow
    approval_status TEXT DEFAULT 'auto_approved',
    approved_by VARCHAR,
    approved_at TIMESTAMP,
    approval_notes TEXT,

    -- Execution status
    status TEXT NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,

    -- Results
    result JSONB,
    error_message TEXT,

    -- Rollback
    rolled_back BOOLEAN DEFAULT FALSE,
    rolled_back_at TIMESTAMP,
    rolled_back_by VARCHAR,
    rollback_reason TEXT,

    -- Metadata
    metadata JSONB,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE remediation_executions IS 'Remediation action execution history';
COMMENT ON COLUMN remediation_executions.status IS 'Values: pending, pending_approval, approved, executing, success, failed, rolled_back';
COMMENT ON COLUMN remediation_executions.approval_status IS 'Values: auto_approved, pending, approved, rejected';

-- ============================================================================
-- 9. CASB Integrations - Cloud Access Security Broker configurations
-- ============================================================================
CREATE TABLE IF NOT EXISTS casb_integrations (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL,

    -- Integration details
    name TEXT NOT NULL,
    provider TEXT NOT NULL,

    -- Connection configuration
    api_endpoint TEXT NOT NULL,
    api_key TEXT,
    api_secret TEXT,
    oauth_config JSONB,

    -- Sync configuration
    sync_enabled BOOLEAN DEFAULT TRUE,
    sync_interval_minutes INTEGER DEFAULT 60,
    last_sync_at TIMESTAMP,
    next_sync_at TIMESTAMP,
    sync_status TEXT DEFAULT 'idle',
    sync_error TEXT,

    -- Features enabled
    features_enabled JSONB DEFAULT '["app_discovery", "risk_scoring", "dlp_alerts"]',

    -- Statistics
    total_apps_synced INTEGER DEFAULT 0,
    total_events_synced INTEGER DEFAULT 0,

    -- Status
    status TEXT NOT NULL DEFAULT 'active',
    connection_verified BOOLEAN DEFAULT FALSE,
    last_health_check_at TIMESTAMP,

    -- Metadata
    config JSONB,
    metadata JSONB,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE casb_integrations IS 'Cloud Access Security Broker integrations';
COMMENT ON COLUMN casb_integrations.provider IS 'Values: netskope, zscaler, mcafee_mvision, microsoft_defender, palo_alto_prisma, forcepoint';
COMMENT ON COLUMN casb_integrations.sync_status IS 'Values: idle, syncing, error';

-- ============================================================================
-- 10. CASB Events - Events received from CASB
-- ============================================================================
CREATE TABLE IF NOT EXISTS casb_events (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL,
    integration_id VARCHAR NOT NULL,

    -- Event identification
    external_event_id TEXT,
    event_type TEXT NOT NULL,
    event_category TEXT,

    -- Event details
    title TEXT,
    description TEXT,
    severity TEXT DEFAULT 'medium',

    -- Related entities
    app_name TEXT,
    app_domain TEXT,
    user_email TEXT,
    user_id VARCHAR,
    device_id VARCHAR,

    -- Risk information
    risk_score INTEGER,
    risk_factors JSONB,

    -- DLP specific
    dlp_policy_name TEXT,
    dlp_violation_type TEXT,
    sensitive_data_types JSONB,

    -- Traffic specific
    bytes_transferred BIGINT,
    file_names JSONB,

    -- Processing
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP,
    linked_app_id VARCHAR,
    alert_generated BOOLEAN DEFAULT FALSE,

    -- Raw event data
    raw_event JSONB,

    -- Timestamps
    event_timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE casb_events IS 'Events received from CASB integrations';
COMMENT ON COLUMN casb_events.event_type IS 'Values: app_access, file_upload, file_download, dlp_violation, anomaly, login, policy_violation';

-- ============================================================================
-- 11. SIEM Integrations - Security Information and Event Management
-- ============================================================================
CREATE TABLE IF NOT EXISTS siem_integrations (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL,

    -- Integration details
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    integration_type TEXT NOT NULL,

    -- Connection configuration
    endpoint_url TEXT,
    api_key TEXT,
    api_secret TEXT,

    -- Syslog configuration
    syslog_host TEXT,
    syslog_port INTEGER DEFAULT 514,
    syslog_protocol TEXT DEFAULT 'tcp',
    syslog_format TEXT DEFAULT 'cef',

    -- Event filtering
    event_types_enabled JSONB DEFAULT '["shadow_it", "high_risk_app", "oauth_grant", "policy_violation"]',
    severity_filter TEXT DEFAULT 'medium',

    -- Batching configuration
    batch_size INTEGER DEFAULT 100,
    flush_interval_seconds INTEGER DEFAULT 30,

    -- Statistics
    events_sent INTEGER DEFAULT 0,
    last_event_sent_at TIMESTAMP,
    errors_count INTEGER DEFAULT 0,

    -- Status
    status TEXT NOT NULL DEFAULT 'active',
    connection_verified BOOLEAN DEFAULT FALSE,
    last_health_check_at TIMESTAMP,

    -- Metadata
    config JSONB,
    metadata JSONB,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE siem_integrations IS 'SIEM integration configurations';
COMMENT ON COLUMN siem_integrations.provider IS 'Values: splunk, elastic, sentinel, qradar, sumo_logic, chronicle, datadog, custom';
COMMENT ON COLUMN siem_integrations.integration_type IS 'Values: api, syslog, webhook';
COMMENT ON COLUMN siem_integrations.syslog_format IS 'Values: cef, leef, json, syslog';

-- ============================================================================
-- 12. SIEM Event Log - Log of events sent to SIEM
-- ============================================================================
CREATE TABLE IF NOT EXISTS siem_event_log (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL,
    integration_id VARCHAR NOT NULL,

    -- Event details
    event_type TEXT NOT NULL,
    event_id TEXT,
    severity TEXT NOT NULL,

    -- Event data
    event_data JSONB NOT NULL,
    formatted_event TEXT,

    -- Related entities
    source_table TEXT,
    source_id VARCHAR,

    -- Delivery status
    status TEXT NOT NULL DEFAULT 'pending',
    sent_at TIMESTAMP,
    delivery_attempts INTEGER DEFAULT 0,
    last_error TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE siem_event_log IS 'Log of events sent to SIEM systems';
COMMENT ON COLUMN siem_event_log.status IS 'Values: pending, sent, failed, dropped';

-- ============================================================================
-- 13. AI Analysis Jobs - AI-powered analytics job tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_analysis_jobs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL,

    -- Job details
    job_type TEXT NOT NULL,
    name TEXT,
    description TEXT,

    -- Scope
    analysis_scope JSONB,

    -- Status
    status TEXT NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    progress_percent INTEGER DEFAULT 0,

    -- Results
    result_summary JSONB,
    recommendations JSONB,
    insights JSONB,

    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Triggering
    triggered_by VARCHAR,
    trigger_type TEXT DEFAULT 'manual',
    schedule_cron TEXT,

    -- Metadata
    metadata JSONB,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE ai_analysis_jobs IS 'AI-powered analysis job tracking';
COMMENT ON COLUMN ai_analysis_jobs.job_type IS 'Values: unused_resource_analysis, cost_optimization, risk_assessment, usage_patterns, anomaly_detection';
COMMENT ON COLUMN ai_analysis_jobs.status IS 'Values: pending, running, completed, failed, cancelled';
COMMENT ON COLUMN ai_analysis_jobs.trigger_type IS 'Values: manual, scheduled, event_triggered';

-- ============================================================================
-- 14. AI Unused Resource Reports - Unused/underutilized resource analysis
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_unused_resource_reports (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL,
    job_id VARCHAR,

    -- Report details
    report_type TEXT NOT NULL,
    report_period_start TIMESTAMP,
    report_period_end TIMESTAMP,

    -- Analysis results
    total_resources_analyzed INTEGER DEFAULT 0,
    unused_resources_found INTEGER DEFAULT 0,
    underutilized_resources_found INTEGER DEFAULT 0,

    -- Cost analysis
    potential_savings_monthly DECIMAL(12,2),
    potential_savings_annual DECIMAL(12,2),
    currency TEXT DEFAULT 'USD',

    -- Detailed findings
    unused_apps JSONB,
    unused_licenses JSONB,
    dormant_users JSONB,
    underutilized_subscriptions JSONB,

    -- AI insights
    ai_summary TEXT,
    ai_recommendations JSONB,
    ai_risk_assessment TEXT,
    ai_confidence_score DECIMAL(3,2),

    -- Action items
    recommended_actions JSONB,

    -- Status
    status TEXT NOT NULL DEFAULT 'draft',
    published_at TIMESTAMP,
    published_by VARCHAR,

    -- Metadata
    metadata JSONB,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE ai_unused_resource_reports IS 'AI-generated unused resource analysis reports';
COMMENT ON COLUMN ai_unused_resource_reports.report_type IS 'Values: monthly_review, quarterly_audit, on_demand, cost_optimization';
COMMENT ON COLUMN ai_unused_resource_reports.status IS 'Values: draft, generated, published, archived';

-- ============================================================================
-- 15. Known SaaS App Catalog - Reference catalog for app identification
-- ============================================================================
CREATE TABLE IF NOT EXISTS known_saas_catalog (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),

    -- App identification
    name TEXT NOT NULL,
    vendor TEXT,
    domains JSONB NOT NULL,

    -- Classification
    category TEXT,
    subcategory TEXT,

    -- Risk profile
    default_risk_score INTEGER DEFAULT 30,
    compliance_certifications JSONB,
    data_residency_regions JSONB,

    -- App info
    description TEXT,
    logo_url TEXT,
    website_url TEXT,

    -- Email patterns for detection
    email_sender_patterns JSONB,
    email_subject_patterns JSONB,

    -- OAuth scopes typically requested
    typical_oauth_scopes JSONB,

    -- Active/inactive
    is_active BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Uniqueness
    UNIQUE(name)
);

COMMENT ON TABLE known_saas_catalog IS 'Reference catalog of known SaaS applications for detection';

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Browser Extension Discoveries
CREATE INDEX IF NOT EXISTS idx_browser_ext_tenant_domain ON browser_extension_discoveries(tenant_id, app_domain);
CREATE INDEX IF NOT EXISTS idx_browser_ext_tenant_user ON browser_extension_discoveries(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_browser_ext_processed ON browser_extension_discoveries(tenant_id, processed);
CREATE INDEX IF NOT EXISTS idx_browser_ext_last_seen ON browser_extension_discoveries(last_seen_at);

-- Email Discovery Events
CREATE INDEX IF NOT EXISTS idx_email_discovery_tenant_domain ON email_discovery_events(tenant_id, sender_domain);
CREATE INDEX IF NOT EXISTS idx_email_discovery_tenant_user ON email_discovery_events(tenant_id, user_email);
CREATE INDEX IF NOT EXISTS idx_email_discovery_processed ON email_discovery_events(tenant_id, processed);
CREATE INDEX IF NOT EXISTS idx_email_discovery_type ON email_discovery_events(tenant_id, discovery_type);

-- Network Traffic Events
CREATE INDEX IF NOT EXISTS idx_network_traffic_tenant_domain ON network_traffic_events(tenant_id, dest_domain);
CREATE INDEX IF NOT EXISTS idx_network_traffic_tenant_user ON network_traffic_events(tenant_id, source_user_id);
CREATE INDEX IF NOT EXISTS idx_network_traffic_processed ON network_traffic_events(tenant_id, processed);
CREATE INDEX IF NOT EXISTS idx_network_traffic_aggregation ON network_traffic_events(aggregation_key);

-- Alert Configurations
CREATE INDEX IF NOT EXISTS idx_alert_config_tenant_type ON alert_configurations(tenant_id, alert_type);
CREATE INDEX IF NOT EXISTS idx_alert_config_tenant_enabled ON alert_configurations(tenant_id, enabled);
CREATE INDEX IF NOT EXISTS idx_alert_config_trigger ON alert_configurations(tenant_id, trigger_event);

-- Alert Instances
CREATE INDEX IF NOT EXISTS idx_alert_instances_tenant_status ON alert_instances(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_alert_instances_tenant_severity ON alert_instances(tenant_id, severity);
CREATE INDEX IF NOT EXISTS idx_alert_instances_config ON alert_instances(configuration_id);
CREATE INDEX IF NOT EXISTS idx_alert_instances_created ON alert_instances(tenant_id, created_at);

-- Notification Channels
CREATE INDEX IF NOT EXISTS idx_notification_channels_tenant ON notification_channels(tenant_id, enabled);
CREATE INDEX IF NOT EXISTS idx_notification_channels_type ON notification_channels(tenant_id, channel_type);

-- Remediation Actions
CREATE INDEX IF NOT EXISTS idx_remediation_actions_tenant ON remediation_actions(tenant_id, enabled);
CREATE INDEX IF NOT EXISTS idx_remediation_actions_trigger ON remediation_actions(tenant_id, trigger_event);
CREATE INDEX IF NOT EXISTS idx_remediation_actions_type ON remediation_actions(tenant_id, action_type);

-- Remediation Executions
CREATE INDEX IF NOT EXISTS idx_remediation_exec_tenant ON remediation_executions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_remediation_exec_action ON remediation_executions(action_id);
CREATE INDEX IF NOT EXISTS idx_remediation_exec_created ON remediation_executions(tenant_id, created_at);

-- CASB Integrations
CREATE INDEX IF NOT EXISTS idx_casb_integrations_tenant ON casb_integrations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_casb_integrations_provider ON casb_integrations(tenant_id, provider);

-- CASB Events
CREATE INDEX IF NOT EXISTS idx_casb_events_tenant_type ON casb_events(tenant_id, event_type);
CREATE INDEX IF NOT EXISTS idx_casb_events_integration ON casb_events(integration_id);
CREATE INDEX IF NOT EXISTS idx_casb_events_processed ON casb_events(tenant_id, processed);
CREATE INDEX IF NOT EXISTS idx_casb_events_timestamp ON casb_events(event_timestamp);

-- SIEM Integrations
CREATE INDEX IF NOT EXISTS idx_siem_integrations_tenant ON siem_integrations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_siem_integrations_provider ON siem_integrations(tenant_id, provider);

-- SIEM Event Log
CREATE INDEX IF NOT EXISTS idx_siem_event_log_tenant ON siem_event_log(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_siem_event_log_integration ON siem_event_log(integration_id);
CREATE INDEX IF NOT EXISTS idx_siem_event_log_created ON siem_event_log(created_at);

-- AI Analysis Jobs
CREATE INDEX IF NOT EXISTS idx_ai_jobs_tenant ON ai_analysis_jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_type ON ai_analysis_jobs(tenant_id, job_type);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_created ON ai_analysis_jobs(created_at);

-- AI Unused Resource Reports
CREATE INDEX IF NOT EXISTS idx_ai_reports_tenant ON ai_unused_resource_reports(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_reports_type ON ai_unused_resource_reports(tenant_id, report_type);
CREATE INDEX IF NOT EXISTS idx_ai_reports_job ON ai_unused_resource_reports(job_id);

-- Known SaaS Catalog
CREATE INDEX IF NOT EXISTS idx_known_saas_name ON known_saas_catalog(name);
CREATE INDEX IF NOT EXISTS idx_known_saas_category ON known_saas_catalog(category);

-- ============================================================================
-- Insert some common SaaS apps into the catalog
-- ============================================================================
INSERT INTO known_saas_catalog (name, vendor, domains, category, default_risk_score, description) VALUES
('Slack', 'Salesforce', '["slack.com", "*.slack.com"]', 'collaboration', 25, 'Team messaging and collaboration platform'),
('Zoom', 'Zoom Video Communications', '["zoom.us", "*.zoom.us"]', 'communication', 30, 'Video conferencing platform'),
('Dropbox', 'Dropbox Inc', '["dropbox.com", "*.dropbox.com"]', 'storage', 35, 'Cloud storage and file sharing'),
('Notion', 'Notion Labs', '["notion.so", "*.notion.so"]', 'productivity', 25, 'All-in-one workspace for notes and docs'),
('Figma', 'Figma Inc', '["figma.com", "*.figma.com"]', 'design', 25, 'Collaborative design platform'),
('Trello', 'Atlassian', '["trello.com", "*.trello.com"]', 'project_management', 25, 'Visual project management'),
('Asana', 'Asana Inc', '["asana.com", "*.asana.com"]', 'project_management', 25, 'Work management platform'),
('HubSpot', 'HubSpot Inc', '["hubspot.com", "*.hubspot.com"]', 'marketing', 30, 'CRM and marketing automation'),
('Salesforce', 'Salesforce', '["salesforce.com", "*.salesforce.com"]', 'crm', 30, 'Customer relationship management'),
('GitHub', 'Microsoft', '["github.com", "*.github.com"]', 'development', 30, 'Code hosting and version control'),
('Jira', 'Atlassian', '["atlassian.net", "*.atlassian.net"]', 'project_management', 25, 'Issue and project tracking'),
('Confluence', 'Atlassian', '["atlassian.net", "*.atlassian.net"]', 'documentation', 25, 'Team documentation and wiki'),
('Monday.com', 'monday.com', '["monday.com", "*.monday.com"]', 'project_management', 25, 'Work operating system'),
('Airtable', 'Airtable', '["airtable.com", "*.airtable.com"]', 'database', 30, 'Spreadsheet-database hybrid'),
('Canva', 'Canva Pty Ltd', '["canva.com", "*.canva.com"]', 'design', 25, 'Graphic design platform'),
('Miro', 'Miro', '["miro.com", "*.miro.com"]', 'collaboration', 25, 'Online whiteboard platform'),
('DocuSign', 'DocuSign', '["docusign.com", "*.docusign.com"]', 'productivity', 30, 'Electronic signature platform'),
('Zendesk', 'Zendesk', '["zendesk.com", "*.zendesk.com"]', 'customer_support', 30, 'Customer service platform'),
('Intercom', 'Intercom', '["intercom.io", "*.intercom.io"]', 'customer_support', 30, 'Customer messaging platform'),
('Mailchimp', 'Intuit', '["mailchimp.com", "*.mailchimp.com"]', 'marketing', 25, 'Email marketing platform')
ON CONFLICT (name) DO NOTHING;
