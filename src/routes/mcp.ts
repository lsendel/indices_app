import { Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv } from '../app'
import { getMcpToolNames } from '../mcp/server'
import { handleGetSentimentAnalysis, handleGetCompetitiveIntel } from '../mcp/tools/sentiment'
import { handleGetHotAccounts, handleScoreLead } from '../mcp/tools/accounts'
import { handleGeneratePersona } from '../mcp/tools/personas'
import { handleGetExperimentAllocation } from '../mcp/tools/experiments'
import { handleAuditBrandContent } from '../mcp/tools/brand'
import { handleGenerateWorkflow } from '../mcp/tools/workflows'
import { handleGetCampaignStats } from '../mcp/tools/campaign-stats'
import { getClientForTenant } from './zeluto'
import { handleCreateCampaignDraft, handleUpdateCampaignCreative, handleGetCampaignPreview, handleListCampaigns } from '../mcp/tools/campaigns'
import { createLLMRouterFromConfig } from '../adapters/llm/factory'
import { handleGetLoopStatus, handleGetPromptLineage, handleGetLoopInsights } from '../mcp/tools/loops'

const TOOL_DESCRIPTIONS: Record<string, string> = {
	get_sentiment_analysis: 'Analyze brand sentiment over a time period',
	get_hot_accounts: 'Get accounts with high buying intent signals',
	generate_persona: 'Generate a synthetic buyer persona from a segment',
	score_lead: 'Score a lead based on engagement signals',
	get_experiment_allocation: 'Get traffic allocation for an experiment',
	get_competitive_intel: 'Get competitive intelligence for a brand',
	audit_brand_content: 'Audit content against a brand kit',
	generate_workflow: 'Auto-generate a campaign workflow DAG',
	get_loop_status: 'Get current status of closed-loop intelligence pipelines',
	get_prompt_lineage: 'Get prompt version history and lineage for a channel',
	create_campaign_draft: 'Create an email campaign draft (cannot send; human approval required)',
	update_campaign_creative: 'Edit campaign creative (clears approval)',
	get_campaign_preview: 'Get campaign creative, hash, approval status and blockers',
	list_campaigns: 'List campaigns with approval status',
	get_campaign_stats: 'Get Zeluto delivery results for an approved campaign',
	get_loop_insights: 'Get aggregated loop intelligence insights over a time period',
}

export function createMcpRoutes() {
	const router = new Hono<AppEnv>()

	router.get('/tools', (c) => {
		const tools = getMcpToolNames().map(name => ({ name, description: TOOL_DESCRIPTIONS[name] ?? '' }))
		return c.json({ tools })
	})

	router.post('/call', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const { tool, arguments: args } = await c.req.json<{ tool: string; arguments: Record<string, unknown> }>()

		const config = {
			OPENAI_API_KEY: c.env.OPENAI_API_KEY,
			OPENAI_MODEL: c.env.OPENAI_MODEL || 'gpt-4o',
			ANTHROPIC_API_KEY: c.env.ANTHROPIC_API_KEY,
			GEMINI_API_KEY: c.env.GEMINI_API_KEY,
			PERPLEXITY_API_KEY: c.env.PERPLEXITY_API_KEY,
			GROK_API_KEY: c.env.GROK_API_KEY,
			HUGGINGFACE_API_KEY: c.env.HUGGINGFACE_API_KEY,
		} as any
		const llmRouter = createLLMRouterFromConfig(config)
		const provider = llmRouter.resolve('analysis:persona')

		const handlers: Record<string, () => Promise<unknown>> = {
			get_sentiment_analysis: () => handleGetSentimentAnalysis(db, args.brand as string, (args.timeframeDays as number) ?? 30, tenantId),
			get_hot_accounts: () => handleGetHotAccounts(db, (args.threshold as number) ?? 70, (args.limit as number) ?? 10, tenantId),
			generate_persona: () => handleGeneratePersona(args.segmentId as string, provider, tenantId),
			score_lead: () => handleScoreLead(args as { email?: string; company?: string; signals: string[] }, tenantId),
			get_experiment_allocation: () => handleGetExperimentAllocation(db, args.experimentId as string, tenantId),
			get_competitive_intel: () => handleGetCompetitiveIntel(db, args.competitor as string, tenantId),
			audit_brand_content: () => handleAuditBrandContent(db, args.content as string, args.brandKitId as string, tenantId),
			create_campaign_draft: () => handleCreateCampaignDraft(db, tenantId, args as any),
			update_campaign_creative: () => handleUpdateCampaignCreative(db, tenantId, args.campaignId as string, args.creative as any),
			get_campaign_preview: () => handleGetCampaignPreview(db, tenantId, args.campaignId as string),
			list_campaigns: () => handleListCampaigns(db, tenantId, (args.limit as number) ?? 20),
			get_campaign_stats: async () => {
				const id = z.string().uuid().safeParse(args.campaignId)
				if (!id.success) return { error: 'campaignId must be a UUID' }
				return handleGetCampaignStats(db, tenantId, id.data, (t) => getClientForTenant(t, db, c.env))
			},
			generate_workflow: () => handleGenerateWorkflow(args.goal as string, provider),
			get_loop_status: () => handleGetLoopStatus(db, tenantId),
			get_prompt_lineage: () => handleGetPromptLineage(db, args.channel as string, tenantId),
			get_loop_insights: () => handleGetLoopInsights(db, (args.days as number) ?? 7, tenantId),
		}

		const handler = handlers[tool]
		if (!handler) return c.json({ error: 'Tool not found' }, 404)

		const result = await handler()
		return c.json({ result })
	})

	return router
}
