CREATE TABLE "feed_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"feed_url" text NOT NULL,
	"feed_type" text DEFAULT 'rss' NOT NULL,
	"schedule" text DEFAULT '0 */6 * * *' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"keywords" text,
	"max_items" integer DEFAULT 50 NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"last_content_hash" text,
	"error_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prompt_versions" ALTER COLUMN "is_active" SET DATA TYPE boolean;--> statement-breakpoint
ALTER TABLE "feed_subscriptions" ADD CONSTRAINT "feed_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_feed_subs_tenant" ON "feed_subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_feed_subs_active" ON "feed_subscriptions" USING btree ("active");--> statement-breakpoint
ALTER TABLE "evolution_cycles" ADD CONSTRAINT "evolution_cycles_agent_config_id_agent_configs_id_fk" FOREIGN KEY ("agent_config_id") REFERENCES "public"."agent_configs"("id") ON DELETE no action ON UPDATE no action;