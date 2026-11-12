ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "brand_key" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "subject" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "preview_text" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "body_html" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "body_text" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "audience_spec" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "content_hash" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "approval_status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "approved_by" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "approved_hash" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_campaigns_approval" ON "campaigns" ("tenant_id","approval_status");
