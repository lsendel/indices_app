CREATE TABLE "loop_prompt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"channel_group" text,
	"system_prompt" text NOT NULL,
	"instruction" text NOT NULL,
	"version" integer NOT NULL,
	"parent_id" uuid,
	"strategy" text,
	"quality_score" real,
	"engagement_score" real,
	"status" text DEFAULT 'candidate' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "content_lineage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"prompt_version_id" uuid NOT NULL,
	"published_content_id" uuid,
	"campaign_id" uuid,
	"experiment_arm_id" uuid,
	"channel" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"engagement_score" real,
	"engagement_updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "loop_prompt_versions" ADD CONSTRAINT "loop_prompt_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_lineage" ADD CONSTRAINT "content_lineage_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_lineage" ADD CONSTRAINT "content_lineage_prompt_version_id_loop_prompt_versions_id_fk" FOREIGN KEY ("prompt_version_id") REFERENCES "public"."loop_prompt_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_loop_prompts_active" ON "loop_prompt_versions" USING btree ("tenant_id","channel","status");--> statement-breakpoint
CREATE INDEX "idx_loop_prompts_parent" ON "loop_prompt_versions" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_lineage_content" ON "content_lineage" USING btree ("published_content_id");--> statement-breakpoint
CREATE INDEX "idx_lineage_prompt" ON "content_lineage" USING btree ("prompt_version_id");--> statement-breakpoint
CREATE INDEX "idx_lineage_tenant" ON "content_lineage" USING btree ("tenant_id");