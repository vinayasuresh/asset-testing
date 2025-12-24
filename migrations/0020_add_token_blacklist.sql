-- Migration: Add token_blacklist table
-- Description: Creates table for JWT token blacklisting (logout, password change, admin revoke)
-- Date: 2025-12-23

CREATE TABLE IF NOT EXISTS token_blacklist (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL,
  user_id VARCHAR NOT NULL,
  tenant_id VARCHAR NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  blacklisted_at TIMESTAMP DEFAULT NOW(),
  reason TEXT DEFAULT 'logout'
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_token_blacklist_hash ON token_blacklist(token_hash);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at);

-- Add comments
COMMENT ON TABLE token_blacklist IS 'Blacklisted JWT tokens for secure logout and token invalidation';
COMMENT ON COLUMN token_blacklist.token_hash IS 'SHA-256 hash of the token (not the token itself for security)';
COMMENT ON COLUMN token_blacklist.expires_at IS 'When the token naturally expires (for cleanup)';
COMMENT ON COLUMN token_blacklist.reason IS 'Reason for blacklisting: logout, password_change, admin_revoke';
