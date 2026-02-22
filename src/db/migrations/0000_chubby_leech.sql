CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"max_campaigns" integer DEFAULT 100 NOT NULL,
	"max_prospects" integer DEFAULT 10000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"company" text NOT NULL,
	"role" text NOT NULL,
	"email" text,
	"phone" text,
	"linkedin_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"goal" text NOT NULL,
	"product_description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"channels_requested" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider" text,
	"message_content" text,
	"message_subject" text,
	"error_message" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppression_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"entry_type" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"actor" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"url" text NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"secret" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drift_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"brand" text NOT NULL,
	"z_score" real NOT NULL,
	"direction" text NOT NULL,
	"baseline_mean" real NOT NULL,
	"current_mean" real NOT NULL,
	"trigger_articles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sentiment_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source" text NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"url" text,
	"author" text,
	"brand" text NOT NULL,
	"sentiment_score" real NOT NULL,
	"sentiment_label" text NOT NULL,
	"themes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"analyzed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrape_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"job_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"callback_url" text NOT NULL,
	"pages_scraped" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scraped_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source" text NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"url" text NOT NULL,
	"author" text,
	"content_hash" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"scraped_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scraped_social" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"post_id" text,
	"title" text,
	"content" text,
	"author" text,
	"url" text,
	"content_hash" text NOT NULL,
	"engagement" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"subreddit" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"posted_at" timestamp with time zone,
	"scraped_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"total_score" integer DEFAULT 0 NOT NULL,
	"behavioral_score" integer DEFAULT 0 NOT NULL,
	"demographic_score" integer DEFAULT 0 NOT NULL,
	"firmographic_score" integer DEFAULT 0 NOT NULL,
	"level" text DEFAULT 'cold' NOT NULL,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"signal_type" text NOT NULL,
	"signal_source" text NOT NULL,
	"strength" integer NOT NULL,
	"signal_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"company" text NOT NULL,
	"domain" text,
	"industry" text,
	"size" text,
	"score" integer DEFAULT 0 NOT NULL,
	"tier" text DEFAULT 'smb' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"value" real NOT NULL,
	"stage" text DEFAULT 'discovery' NOT NULL,
	"probability" integer DEFAULT 0 NOT NULL,
	"expected_close_date" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiment_arms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"variant_name" text NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"alpha" real DEFAULT 1 NOT NULL,
	"beta" real DEFAULT 1 NOT NULL,
	"traffic_pct" real DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'ab_test' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"target_metric" text NOT NULL,
	"winner_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persona_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"ocean_scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"demographics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"motivations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pain_points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferred_channels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"derivation" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_kits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"brand_name" text NOT NULL,
	"colors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"typography" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"voice_attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"logo_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"color_tolerance" integer DEFAULT 50 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"sync_type" text NOT NULL,
	"direction" text DEFAULT 'outbound' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"resource_id" text,
	"external_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zeluto_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"user_role" text DEFAULT 'admin' NOT NULL,
	"plan" text DEFAULT 'pro' NOT NULL,
	"webhook_secret" text,
	"webhook_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "zeluto_configs_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "delivery_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"zeluto_job_id" text,
	"campaign_id" uuid,
	"experiment_id" uuid,
	"contact_email" text,
	"channel" text NOT NULL,
	"event_type" text NOT NULL,
	"provider_message_id" text,
	"event_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"source_node_id" uuid NOT NULL,
	"target_node_id" uuid NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"agent_config_id" uuid,
	"inputs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"outputs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"input_values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output_values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"execution_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"goal" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"campaign_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"system_prompt" text NOT NULL,
	"instruction_prompt" text NOT NULL,
	"inputs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"outputs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_gradients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt_version_id" uuid NOT NULL,
	"gradient" text NOT NULL,
	"loss" real NOT NULL,
	"improvement_suggestion" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_config_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"system_prompt" text NOT NULL,
	"instruction_prompt" text NOT NULL,
	"score" real,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evolution_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"score" real,
	"parent_ids" text,
	"mutation_strategy" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evolution_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"agent_config_id" uuid,
	"generation" integer NOT NULL,
	"strategy" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"best_score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "hitl_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"workflow_id" uuid NOT NULL,
	"node_id" uuid NOT NULL,
	"decision" text DEFAULT 'pending' NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"modifications" jsonb,
	"decided_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_results" ADD CONSTRAINT "channel_results_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppression_entries" ADD CONSTRAINT "suppression_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drift_events" ADD CONSTRAINT "drift_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sentiment_articles" ADD CONSTRAINT "sentiment_articles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrape_jobs" ADD CONSTRAINT "scrape_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scraped_articles" ADD CONSTRAINT "scraped_articles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scraped_social" ADD CONSTRAINT "scraped_social_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_scores" ADD CONSTRAINT "account_scores_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_arms" ADD CONSTRAINT "experiment_arms_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_profiles" ADD CONSTRAINT "persona_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_kits" ADD CONSTRAINT "brand_kits_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zeluto_configs" ADD CONSTRAINT "zeluto_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_edges" ADD CONSTRAINT "workflow_edges_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_edges" ADD CONSTRAINT "workflow_edges_source_node_id_workflow_nodes_id_fk" FOREIGN KEY ("source_node_id") REFERENCES "public"."workflow_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_edges" ADD CONSTRAINT "workflow_edges_target_node_id_workflow_nodes_id_fk" FOREIGN KEY ("target_node_id") REFERENCES "public"."workflow_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_nodes" ADD CONSTRAINT "workflow_nodes_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_configs" ADD CONSTRAINT "agent_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_gradients" ADD CONSTRAINT "prompt_gradients_prompt_version_id_prompt_versions_id_fk" FOREIGN KEY ("prompt_version_id") REFERENCES "public"."prompt_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_agent_config_id_agent_configs_id_fk" FOREIGN KEY ("agent_config_id") REFERENCES "public"."agent_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evolution_candidates" ADD CONSTRAINT "evolution_candidates_cycle_id_evolution_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."evolution_cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evolution_cycles" ADD CONSTRAINT "evolution_cycles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hitl_requests" ADD CONSTRAINT "hitl_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hitl_requests" ADD CONSTRAINT "hitl_requests_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hitl_requests" ADD CONSTRAINT "hitl_requests_node_id_workflow_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."workflow_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_prospects_email" ON "prospects" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_prospects_tenant" ON "prospects" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_prospects_company" ON "prospects" USING btree ("company");--> statement-breakpoint
CREATE INDEX "idx_campaigns_tenant" ON "campaigns" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_campaigns_status" ON "campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_campaigns_created" ON "campaigns" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_segments_tenant" ON "segments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_suppression_email" ON "suppression_entries" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_suppression_tenant" ON "suppression_entries" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_audit_tenant" ON "audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_audit_created" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_action" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_drift_tenant" ON "drift_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_drift_brand" ON "drift_events" USING btree ("brand");--> statement-breakpoint
CREATE INDEX "idx_drift_created" ON "drift_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_sentiment_tenant" ON "sentiment_articles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_sentiment_brand" ON "sentiment_articles" USING btree ("brand");--> statement-breakpoint
CREATE INDEX "idx_sentiment_source" ON "sentiment_articles" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_sentiment_analyzed" ON "sentiment_articles" USING btree ("analyzed_at");--> statement-breakpoint
CREATE INDEX "idx_scrape_jobs_tenant" ON "scrape_jobs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_scrape_jobs_status" ON "scrape_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_scraped_articles_hash" ON "scraped_articles" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "idx_scraped_articles_tenant" ON "scraped_articles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_scraped_articles_source" ON "scraped_articles" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_scraped_social_hash" ON "scraped_social" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "idx_scraped_social_tenant" ON "scraped_social" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_scraped_social_platform" ON "scraped_social" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "idx_account_scores_tenant" ON "account_scores" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_account_scores_account" ON "account_scores" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_account_scores_level" ON "account_scores" USING btree ("level");--> statement-breakpoint
CREATE INDEX "idx_signals_tenant" ON "signals" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_signals_account" ON "signals" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_signals_type" ON "signals" USING btree ("signal_type");--> statement-breakpoint
CREATE INDEX "idx_signals_created" ON "signals" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_accounts_tenant" ON "accounts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_accounts_company" ON "accounts" USING btree ("company");--> statement-breakpoint
CREATE INDEX "idx_accounts_tier" ON "accounts" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "idx_accounts_score" ON "accounts" USING btree ("score");--> statement-breakpoint
CREATE INDEX "idx_deals_tenant" ON "deals" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_deals_account" ON "deals" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_deals_stage" ON "deals" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "idx_deals_created" ON "deals" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_arms_experiment" ON "experiment_arms" USING btree ("experiment_id");--> statement-breakpoint
CREATE INDEX "idx_experiments_tenant" ON "experiments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_experiments_status" ON "experiments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_personas_tenant" ON "persona_profiles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_brand_kits_tenant" ON "brand_kits" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sync_logs_tenant_idx" ON "sync_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sync_logs_type_idx" ON "sync_logs" USING btree ("sync_type");--> statement-breakpoint
CREATE INDEX "sync_logs_status_idx" ON "sync_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "zeluto_configs_tenant_idx" ON "zeluto_configs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "delivery_events_tenant_idx" ON "delivery_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "delivery_events_campaign_idx" ON "delivery_events" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "delivery_events_experiment_idx" ON "delivery_events" USING btree ("experiment_id");--> statement-breakpoint
CREATE INDEX "delivery_events_type_idx" ON "delivery_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "delivery_events_occurred_idx" ON "delivery_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idx_workflow_edges_workflow" ON "workflow_edges" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_nodes_workflow" ON "workflow_nodes" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "idx_workflow_nodes_status" ON "workflow_nodes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_workflows_tenant" ON "workflows" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_workflows_status" ON "workflows" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_agent_configs_tenant" ON "agent_configs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_prompt_gradients_version" ON "prompt_gradients" USING btree ("prompt_version_id");--> statement-breakpoint
CREATE INDEX "idx_prompt_versions_agent" ON "prompt_versions" USING btree ("agent_config_id");--> statement-breakpoint
CREATE INDEX "idx_prompt_versions_version" ON "prompt_versions" USING btree ("agent_config_id","version");--> statement-breakpoint
CREATE INDEX "idx_evolution_candidates_cycle" ON "evolution_candidates" USING btree ("cycle_id");--> statement-breakpoint
CREATE INDEX "idx_evolution_cycles_tenant" ON "evolution_cycles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_evolution_cycles_status" ON "evolution_cycles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_hitl_requests_tenant" ON "hitl_requests" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_hitl_requests_workflow" ON "hitl_requests" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "idx_hitl_requests_decision" ON "hitl_requests" USING btree ("decision");