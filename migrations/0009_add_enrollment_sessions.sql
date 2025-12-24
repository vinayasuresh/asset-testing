-- Create enrollment_sessions table for nonce-based PKG enrollment
CREATE TABLE IF NOT EXISTS "enrollment_sessions" (
	"nonce" text PRIMARY KEY NOT NULL,
	"tenant_id" varchar NOT NULL,
	"tenant_token" text NOT NULL,
	"status" text DEFAULT 'issued' NOT NULL,
	"user_agent" text,
	"ip_hash" text,
	"serial" text,
	"hostname" text,
	"osv" text,
	"claimed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL
);
