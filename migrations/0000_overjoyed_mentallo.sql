CREATE TABLE "ai_responses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt" text NOT NULL,
	"response" text NOT NULL,
	"user_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "asset_utilization" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" varchar NOT NULL,
	"cpu_usage" numeric(5, 2),
	"ram_usage" numeric(5, 2),
	"disk_usage" numeric(5, 2),
	"network_usage" numeric(10, 2),
	"recorded_at" timestamp DEFAULT now(),
	"tenant_id" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"category" text,
	"manufacturer" text,
	"model" text,
	"serial_number" text,
	"status" text DEFAULT 'in-stock' NOT NULL,
	"location" text,
	"country" text,
	"state" text,
	"city" text,
	"assigned_user_id" varchar,
	"assigned_user_name" text,
	"assigned_user_email" text,
	"assigned_user_employee_id" text,
	"purchase_date" timestamp,
	"purchase_cost" numeric(10, 2),
	"warranty_expiry" timestamp,
	"amc_expiry" timestamp,
	"specifications" jsonb,
	"notes" text,
	"software_name" text,
	"version" text,
	"license_type" text,
	"license_key" text,
	"used_licenses" integer,
	"renewal_date" timestamp,
	"vendor_name" text,
	"vendor_email" text,
	"vendor_phone" text,
	"company_name" text,
	"company_gst_number" text,
	"tenant_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" varchar,
	"user_id" varchar NOT NULL,
	"user_email" text NOT NULL,
	"user_role" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"before_state" jsonb,
	"after_state" jsonb,
	"description" text,
	"tenant_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "master_data" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"metadata" jsonb,
	"created_by" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"potential_savings" numeric(10, 2),
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"asset_ids" jsonb,
	"generated_at" timestamp DEFAULT now(),
	"tenant_id" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "software_licenses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"vendor" text,
	"version" text,
	"license_key" text,
	"license_type" text,
	"total_licenses" integer NOT NULL,
	"used_licenses" integer DEFAULT 0 NOT NULL,
	"cost_per_license" numeric(10, 2),
	"renewal_date" timestamp,
	"notes" text,
	"tenant_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenant_admin_lock" (
	"tenant_id" varchar PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"website" text,
	"industry" text,
	"employee_count" integer,
	"support_email" text,
	"timezone" text DEFAULT 'UTC',
	"currency" text DEFAULT 'USD',
	"date_format" text DEFAULT 'MM/DD/YYYY',
	"fiscal_year_start" text DEFAULT '01-01',
	"auto_recommendations" boolean DEFAULT true,
	"data_retention_days" integer DEFAULT 365,
	"enforce_sso" boolean DEFAULT false,
	"require_mfa" boolean DEFAULT false,
	"session_timeout" integer DEFAULT 480,
	"password_policy" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ticket_activities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"activity_type" text NOT NULL,
	"description" text NOT NULL,
	"actor_id" varchar NOT NULL,
	"actor_name" text NOT NULL,
	"actor_role" text NOT NULL,
	"metadata" jsonb,
	"tenant_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ticket_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"author_id" varchar NOT NULL,
	"author_name" text NOT NULL,
	"author_role" text NOT NULL,
	"content" text NOT NULL,
	"is_internal" boolean DEFAULT false,
	"attachments" jsonb,
	"tenant_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_number" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"requestor_id" varchar NOT NULL,
	"requestor_name" text NOT NULL,
	"requestor_email" text NOT NULL,
	"assigned_to_id" varchar,
	"assigned_to_name" text,
	"assigned_by_id" varchar,
	"assigned_by_name" text,
	"assigned_at" timestamp,
	"resolved_at" timestamp,
	"closed_at" timestamp,
	"due_date" timestamp,
	"resolution" text,
	"resolution_notes" text,
	"asset_id" varchar,
	"asset_name" text,
	"attachments" jsonb,
	"tags" text[],
	"tenant_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tickets_ticket_number_unique" UNIQUE("ticket_number")
);
--> statement-breakpoint
CREATE TABLE "user_invitations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"role" text DEFAULT 'technician' NOT NULL,
	"tenant_id" varchar NOT NULL,
	"invited_by" varchar NOT NULL,
	"token" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"email_notifications" boolean DEFAULT true,
	"push_notifications" boolean DEFAULT false,
	"ai_recommendation_alerts" boolean DEFAULT true,
	"weekly_reports" boolean DEFAULT false,
	"asset_expiry_alerts" boolean DEFAULT true,
	"theme" text DEFAULT 'light',
	"language" text DEFAULT 'en',
	"timezone" text DEFAULT 'UTC',
	"date_format" text DEFAULT 'MM/DD/YYYY',
	"dashboard_layout" jsonb,
	"items_per_page" integer DEFAULT 25,
	"tenant_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"role" text DEFAULT 'technician' NOT NULL,
	"avatar" text,
	"phone" text,
	"department" text,
	"job_title" text,
	"manager" text,
	"last_login_at" timestamp,
	"is_active" boolean DEFAULT true,
	"must_change_password" boolean DEFAULT false,
	"tenant_id" varchar NOT NULL,
	"invited_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
