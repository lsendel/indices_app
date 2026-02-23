CREATE TABLE "platform_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"scopes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "published_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"channel" text NOT NULL,
	"platform_content_id" text,
	"platform_url" text,
	"content" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"campaign_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engagement_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"published_content_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"event_type" text NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evolution_cycles" ADD COLUMN "population_size" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "evolution_cycles" ADD COLUMN "generations" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_connections" ADD CONSTRAINT "platform_connections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_content" ADD CONSTRAINT "published_content_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_events" ADD CONSTRAINT "engagement_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_connections_tenant_idx" ON "platform_connections" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "platform_connections_platform_idx" ON "platform_connections" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "published_content_tenant_idx" ON "published_content" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "published_content_platform_idx" ON "published_content" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "published_content_campaign_idx" ON "published_content" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "published_content_status_idx" ON "published_content" USING btree ("status");--> statement-breakpoint
CREATE INDEX "engagement_events_tenant_idx" ON "engagement_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "engagement_events_content_idx" ON "engagement_events" USING btree ("published_content_id");--> statement-breakpoint
CREATE INDEX "engagement_events_platform_idx" ON "engagement_events" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "engagement_events_type_idx" ON "engagement_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "engagement_events_recorded_idx" ON "engagement_events" USING btree ("recorded_at");--> statement-breakpoint
ALTER TABLE "workflow_nodes" ADD CONSTRAINT "workflow_nodes_agent_config_id_agent_configs_id_fk" FOREIGN KEY ("agent_config_id") REFERENCES "public"."agent_configs"("id") ON DELETE no action ON UPDATE no action;