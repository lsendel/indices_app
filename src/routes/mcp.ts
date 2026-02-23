import { Hono } from 'hono'
import type { AppEnv } from '../app'
import { getMcpToolNames } from '../mcp/server'
import { handleGetSentimentAnalysis, handleGetCompetitiveIntel } from '../mcp/tools/sentiment'
import { handleGetHotAccounts, handleScoreLead } from '../mcp/tools/accounts'
import { handleGeneratePersona } from '../mcp/tools/personas'
import { handleGetExperimentAllocation } from '../mcp/tools/experiments'
import { handleAuditBrandContent } from '../mcp/tools/brand'
import { handleGenerateWorkflow } from '../mcp/tools/workflows'
import { createLLMRouterFromConfig } from '../adapters/llm/factory'
import { getConfig } from '../config'
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
	get_loop_insights: 'Get aggregated loop intelligence insights over a time period',
}

export function createMcpRoutes() {
	const router = new Hono<AppEnv>()

	router.get('/tools', (c) => {
		const tools = getMcpToolNames().map(name => ({ name, description: TOOL_DESCRIPTIONS[name] ?? '' }))
		return c.json({ tools })
	})

	router.post('/call', async (c) => {
		const tenantId = c.get('tenantId')!
		const { tool, arguments: args } = await c.req.json<{ tool: string; arguments: Record<string, unknown> }>()

		const router = createLLMRouterFromConfig(getConfig())
		const provider = router.resolve('analysis:persona')

		const handlers: Record<string, () => Promise<unknown>> = {
			get_sentiment_analysis: () => handleGetSentimentAnalysis(args.brand as string, (args.timeframeDays as number) ?? 30, tenantId),
			get_hot_accounts: () => handleGetHotAccounts((args.threshold as number) ?? 70, (args.limit as number) ?? 10, tenantId),
			generate_persona: () => handleGeneratePersona(args.segmentId as string, provider, tenantId),
			score_lead: () => handleScoreLead(args as { email?: string; company?: string; signals: string[] }, tenantId),
			get_experiment_allocation: () => handleGetExperimentAllocation(args.experimentId as string, tenantId),
			get_competitive_intel: () => handleGetCompetitiveIntel(args.competitor as string, tenantId),
			audit_brand_content: () => handleAuditBrandContent(args.content as string, args.brandKitId as string, tenantId),
			generate_workflow: () => handleGenerateWorkflow(args.goal as string, provider),
			get_loop_status: () => handleGetLoopStatus(tenantId),
			get_prompt_lineage: () => handleGetPromptLineage(args.channel as string, tenantId),
			get_loop_insights: () => handleGetLoopInsights((args.days as number) ?? 7, tenantId),
		}

		const handler = handlers[tool]
		if (!handler) return c.json({ error: 'Tool not found' }, 404)

		const result = await handler()
		return c.json({ result })
	})

	return router
}
