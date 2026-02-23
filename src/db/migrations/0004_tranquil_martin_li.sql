DROP INDEX "idx_loop_rules_tenant_active";--> statement-breakpoint
DROP INDEX "idx_channel_groups_refresh";--> statement-breakpoint
DROP INDEX "idx_loop_prompts_active";--> statement-breakpoint
ALTER TABLE "loop_events" ADD CONSTRAINT "loop_events_pipeline_id_loop_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."loop_pipelines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loop_prompt_versions" ADD CONSTRAINT "loop_prompt_versions_parent_id_loop_prompt_versions_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."loop_prompt_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_loop_rules_tenant_active" ON "loop_rules" USING btree ("tenant_id","active") WHERE "loop_rules"."active" = true;--> statement-breakpoint
CREATE INDEX "idx_channel_groups_refresh" ON "loop_channel_groups" USING btree ("tenant_id","auto_refresh") WHERE "loop_channel_groups"."auto_refresh" = true;--> statement-breakpoint
CREATE INDEX "idx_loop_prompts_active" ON "loop_prompt_versions" USING btree ("tenant_id","channel","status") WHERE "loop_prompt_versions"."status" = 'active';