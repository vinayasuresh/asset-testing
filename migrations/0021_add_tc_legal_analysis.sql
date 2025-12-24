-- Migration: Add T&C Legal Analysis table for Terms & Conditions Risk Scanner
-- This table stores AI-powered analysis of SaaS application terms, privacy policies, and EULAs

CREATE TABLE IF NOT EXISTS tc_legal_analysis (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    app_id VARCHAR(255) NOT NULL,

    -- Source URLs analyzed
    terms_url TEXT,
    privacy_policy_url TEXT,
    eula_url TEXT,
    dpa_url TEXT,

    -- Analysis metadata
    analysis_date TIMESTAMP DEFAULT NOW(),
    analysis_version TEXT DEFAULT '1.0',
    document_hash TEXT,
    ai_model TEXT DEFAULT 'gpt-4o',

    -- Overall Risk Assessment
    overall_risk_score INTEGER DEFAULT 0,
    risk_level TEXT DEFAULT 'unknown',

    -- Data Handling Clauses
    data_residency TEXT,
    data_residency_compliant BOOLEAN,
    data_ownership TEXT,
    data_retention TEXT,
    data_deletion TEXT,
    data_portability BOOLEAN,

    -- Third-Party & Subprocessors
    subprocessors_allowed BOOLEAN,
    subprocessors_list JSONB,
    third_party_sharing TEXT,

    -- Security & Compliance Claims
    security_certifications JSONB,
    encryption_claims TEXT,
    breach_notification_days INTEGER,

    -- Legal Terms
    governing_law TEXT,
    dispute_resolution TEXT,
    liability_limitation TEXT,
    indemnification TEXT,

    -- Termination & Exit
    termination_rights TEXT,
    termination_notice_days INTEGER,
    data_export_on_termination BOOLEAN,

    -- IP & Confidentiality
    ip_ownership TEXT,
    confidentiality_terms TEXT,

    -- SLA Terms
    uptime_guarantee TEXT,
    sla_penalties TEXT,
    support_terms TEXT,

    -- Auto-Renewal & Pricing
    auto_renewal_clause BOOLEAN,
    price_change_notice TEXT,

    -- AI/ML Specific
    ai_data_usage TEXT,
    ai_opt_out BOOLEAN,

    -- Regulatory Compliance Flags
    gdpr_compliant BOOLEAN,
    dpdp_compliant BOOLEAN,
    hipaa_compliant BOOLEAN,
    soc2_compliant BOOLEAN,

    -- Risk Flags (detailed findings)
    risk_flags JSONB,

    -- Compliance Mapping
    regulatory_mapping JSONB,

    -- Key Clauses Summary
    key_clauses JSONB,

    -- AI Analysis Summary
    executive_summary TEXT,
    recommendations JSONB,

    -- Analysis confidence
    confidence_score INTEGER DEFAULT 0,
    manual_review_required BOOLEAN DEFAULT false,

    -- Review workflow
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    approval_status TEXT DEFAULT 'pending',

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_tc_legal_tenant_app ON tc_legal_analysis(tenant_id, app_id);
CREATE INDEX IF NOT EXISTS idx_tc_legal_tenant_risk ON tc_legal_analysis(tenant_id, risk_level);
CREATE INDEX IF NOT EXISTS idx_tc_legal_tenant_approval ON tc_legal_analysis(tenant_id, approval_status);

-- Add comments for documentation
COMMENT ON TABLE tc_legal_analysis IS 'T&C Risk Scanner - AI analysis of SaaS app terms, privacy policies, and EULAs';
COMMENT ON COLUMN tc_legal_analysis.overall_risk_score IS 'Risk score from 0-100, higher means more risk';
COMMENT ON COLUMN tc_legal_analysis.risk_level IS 'Categorized risk: low, medium, high, critical';
COMMENT ON COLUMN tc_legal_analysis.data_residency_compliant IS 'True if data storage meets India data localization requirements';
COMMENT ON COLUMN tc_legal_analysis.regulatory_mapping IS 'Mapping to SEBI, RBI, IRDAI, DPDP compliance controls';
COMMENT ON COLUMN tc_legal_analysis.risk_flags IS 'Array of specific risk findings with severity and recommendations';
