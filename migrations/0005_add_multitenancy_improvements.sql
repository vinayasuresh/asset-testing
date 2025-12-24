-- Migration: Add Multi-Tenancy Improvements
-- Date: 2025-11-03
-- Description: Adds enrollment tokens table and per-tenant OpenAudit configuration

-- Add OpenAudit configuration columns to tenants table
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "openaudit_url" text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "openaudit_username" text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "openaudit_password" text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "openaudit_sync_enabled" boolean DEFAULT false;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "openaudit_sync_cron" text DEFAULT '*/5 * * * *';
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "openaudit_last_sync" timestamp;

-- Create enrollment_tokens table
CREATE TABLE IF NOT EXISTS "enrollment_tokens" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "token" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text,
  "tenant_id" varchar NOT NULL,
  "site_id" varchar,
  "site_name" text,
  "max_uses" integer,
  "usage_count" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "expires_at" timestamp,
  "created_by" varchar NOT NULL,
  "last_used_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Create indexes for enrollment_tokens
CREATE INDEX IF NOT EXISTS "idx_enrollment_tokens_tenant" ON "enrollment_tokens"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_enrollment_tokens_active" ON "enrollment_tokens"("is_active");
CREATE INDEX IF NOT EXISTS "idx_enrollment_tokens_token" ON "enrollment_tokens"("token");
