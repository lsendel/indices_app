import { creativeUpdate } from '../services/campaigns/creative'
import { handleCreateCampaignDraft, handleUpdateCampaignCreative, handleGetCampaignPreview, handleListCampaigns } from './tools/campaigns'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Database } from '../db/client'
import type { LLMProvider } from '../adapters/llm/types'
import { handleGetLoopStatus, handleGetPromptLineage, handleGetLoopInsights } from './tools/loops'
import { handleGetSentimentAnalysis, handleGetCompetitiveIntel } from './tools/sentiment'
import { handleGetHotAccounts, handleScoreLead } from './tools/accounts'
import { handleGeneratePersona } from './tools/personas'
import { handleGetExperimentAllocation } from './tools/experiments'
import { handleAuditBrandContent } from './tools/brand'
import { handleGenerateWorkflow } from './tools/workflows'

const TOOL_DEFINITIONS = [
	'get_sentiment_analysis',
	'get_hot_accounts',
	'generate_persona',
	'score_lead',
	'get_experiment_allocation',
	'get_competitive_intel',
	'audit_brand_content',
	'generate_workflow',
	'get_loop_status',
	'get_prompt_lineage',
	'get_loop_insights',
	'create_campaign_draft',
	'update_campaign_creative',
	'get_campaign_preview',
	'list_campaigns',
] as const

export function getMcpToolNames(): string[] {
	return [...TOOL_DEFINITIONS]
}

function jsonResult(data: unknown) {
	return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] }
}

function noDb() {
	return jsonResult({ error: 'No database connection' })
}

export function createMcpServer(db?: Database, provider?: LLMProvider): McpServer {
	const server = new McpServer({
		name: 'indices-intelligence',
		version: '1.0.0',
	})

	server.tool(
		'get_sentiment_analysis',
		'Analyze brand sentiment over a time period',
		{ brand: z.string(), timeframeDays: z.number().int().default(30) },
		async ({ brand, timeframeDays }) => {
			if (!db) return noDb()
			return jsonResult(await handleGetSentimentAnalysis(db, brand, timeframeDays, 'unknown'))
		},
	)

	server.tool(
		'get_hot_accounts',
		'Get accounts with high buying intent signals',
		{ threshold: z.number().int().min(1).max(100).default(70), limit: z.number().int().min(1).max(50).default(10) },
		async ({ threshold, limit }) => {
			if (!db) return noDb()
			return jsonResult(await handleGetHotAccounts(db, threshold, limit, 'unknown'))
		},
	)

	server.tool(
		'generate_persona',
		'Generate a synthetic buyer persona from a segment',
		{ segmentId: z.string().uuid() },
		async ({ segmentId }) => {
			if (!provider) return jsonResult({ error: 'No LLM provider configured' })
			return jsonResult(await handleGeneratePersona(segmentId, provider, 'unknown'))
		},
	)

	server.tool(
		'score_lead',
		'Score a lead based on engagement signals and demographics',
		{ email: z.string().email().optional(), company: z.string().optional(), signals: z.array(z.string()).default([]) },
		async (input) => {
			return jsonResult(await handleScoreLead(input, 'unknown'))
		},
	)

	server.tool(
		'get_experiment_allocation',
		'Get current traffic allocation for an A/B or MAB experiment',
		{ experimentId: z.string().uuid() },
		async ({ experimentId }) => {
			if (!db) return noDb()
			return jsonResult(await handleGetExperimentAllocation(db, experimentId, 'unknown'))
		},
	)

	server.tool(
		'get_competitive_intel',
		'Get competitive intelligence for a competitor brand',
		{ competitor: z.string() },
		async ({ competitor }) => {
			if (!db) return noDb()
			return jsonResult(await handleGetCompetitiveIntel(db, competitor, 'unknown'))
		},
	)

	server.tool(
		'audit_brand_content',
		'Audit content against a brand kit for compliance',
		{ content: z.string(), brandKitId: z.string().uuid() },
		async (input) => {
			if (!db) return noDb()
			return jsonResult(await handleAuditBrandContent(db, input.content, input.brandKitId, 'unknown'))
		},
	)

	server.tool(
		'generate_workflow',
		'Auto-generate a campaign workflow DAG from a marketing goal',
		{ goal: z.string(), context: z.string().optional() },
		async (input) => {
			if (!provider) return jsonResult({ error: 'No LLM provider configured' })
			return jsonResult(await handleGenerateWorkflow(input.goal, provider))
		},
	)

	server.tool(
		'create_campaign_draft',
		'Create an email campaign draft (creative + audience spec). Drafts cannot send; a human must approve in Indices.',
		{ tenantId: z.string().uuid(), name: z.string().min(1).max(200), goal: z.string().min(1).max(200), creative: creativeUpdate },
		async (input) => {
			if (!db) return noDb()
			return jsonResult(await handleCreateCampaignDraft(db, input.tenantId, { name: input.name, goal: input.goal, creative: input.creative }))
		},
	)

	server.tool(
		'update_campaign_creative',
		'Edit campaign creative. Editing clears any prior approval.',
		{ tenantId: z.string().uuid(), campaignId: z.string().uuid(), creative: creativeUpdate },
		async (input) => {
			if (!db) return noDb()
			return jsonResult(await handleUpdateCampaignCreative(db, input.tenantId, input.campaignId, input.creative))
		},
	)

	server.tool(
		'get_campaign_preview',
		'Get campaign creative, content hash, approval status and approval blockers',
		{ tenantId: z.string().uuid(), campaignId: z.string().uuid() },
		async (input) => {
			if (!db) return noDb()
			return jsonResult(await handleGetCampaignPreview(db, input.tenantId, input.campaignId))
		},
	)

	server.tool(
		'list_campaigns',
		'List campaigns with approval status',
		{ tenantId: z.string().uuid(), limit: z.number().int().min(1).max(100).default(20) },
		async (input) => {
			if (!db) return noDb()
			return jsonResult(await handleListCampaigns(db, input.tenantId, input.limit))
		},
	)

	server.tool(
		'get_loop_status',
		'Get current status of closed-loop intelligence pipelines',
		{ tenantId: z.string().uuid().optional() },
		async (input) => {
			if (!db) return noDb()
			return jsonResult(await handleGetLoopStatus(db, input.tenantId ?? 'unknown'))
		},
	)

	server.tool(
		'get_prompt_lineage',
		'Get prompt version history and lineage for a channel',
		{ channel: z.string() },
		async ({ channel }) => {
			if (!db) return noDb()
			return jsonResult(await handleGetPromptLineage(db, channel, 'unknown'))
		},
	)

	server.tool(
		'get_loop_insights',
		'Get aggregated loop intelligence insights over a time period',
		{ days: z.number().int().min(1).max(90).default(7) },
		async ({ days }) => {
			if (!db) return noDb()
			return jsonResult(await handleGetLoopInsights(db, days, 'unknown'))
		},
	)

	return server
}
