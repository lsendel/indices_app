import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { handleGetLoopStatus, handleGetPromptLineage, handleGetLoopInsights } from './tools/loops'

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
] as const

export function getMcpToolNames(): string[] {
	return [...TOOL_DEFINITIONS]
}

export function createMcpServer(): McpServer {
	const server = new McpServer({
		name: 'indices-intelligence',
		version: '1.0.0',
	})

	server.tool(
		'get_sentiment_analysis',
		'Analyze brand sentiment over a time period',
		{ brand: z.string(), timeframeDays: z.number().int().default(30) },
		async ({ brand, timeframeDays }) => {
			return { content: [{ type: 'text' as const, text: JSON.stringify({ brand, timeframeDays, status: 'not_implemented' }) }] }
		},
	)

	server.tool(
		'get_hot_accounts',
		'Get accounts with high buying intent signals',
		{ threshold: z.number().int().min(1).max(100).default(70), limit: z.number().int().min(1).max(50).default(10) },
		async ({ threshold, limit }) => {
			return { content: [{ type: 'text' as const, text: JSON.stringify({ threshold, limit, status: 'not_implemented' }) }] }
		},
	)

	server.tool(
		'generate_persona',
		'Generate a synthetic buyer persona from a segment',
		{ segmentId: z.string().uuid() },
		async ({ segmentId }) => {
			return { content: [{ type: 'text' as const, text: JSON.stringify({ segmentId, status: 'not_implemented' }) }] }
		},
	)

	server.tool(
		'score_lead',
		'Score a lead based on engagement signals and demographics',
		{ email: z.string().email().optional(), company: z.string().optional(), signals: z.array(z.string()).default([]) },
		async (input) => {
			return { content: [{ type: 'text' as const, text: JSON.stringify({ ...input, status: 'not_implemented' }) }] }
		},
	)

	server.tool(
		'get_experiment_allocation',
		'Get current traffic allocation for an A/B or MAB experiment',
		{ experimentId: z.string().uuid() },
		async ({ experimentId }) => {
			return { content: [{ type: 'text' as const, text: JSON.stringify({ experimentId, status: 'not_implemented' }) }] }
		},
	)

	server.tool(
		'get_competitive_intel',
		'Get competitive intelligence for a competitor brand',
		{ competitor: z.string() },
		async ({ competitor }) => {
			return { content: [{ type: 'text' as const, text: JSON.stringify({ competitor, status: 'not_implemented' }) }] }
		},
	)

	server.tool(
		'audit_brand_content',
		'Audit content against a brand kit for compliance',
		{ content: z.string(), brandKitId: z.string().uuid() },
		async (input) => {
			return { content: [{ type: 'text' as const, text: JSON.stringify({ ...input, status: 'not_implemented' }) }] }
		},
	)

	server.tool(
		'generate_workflow',
		'Auto-generate a campaign workflow DAG from a marketing goal',
		{ goal: z.string(), context: z.string().optional() },
		async (input) => {
			return { content: [{ type: 'text' as const, text: JSON.stringify({ ...input, status: 'not_implemented' }) }] }
		},
	)

	server.tool(
		'get_loop_status',
		'Get current status of closed-loop intelligence pipelines',
		{ tenantId: z.string().uuid().optional() },
		async (input) => {
			const result = await handleGetLoopStatus(input.tenantId ?? 'unknown')
			return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
		},
	)

	server.tool(
		'get_prompt_lineage',
		'Get prompt version history and lineage for a channel',
		{ channel: z.string() },
		async ({ channel }) => {
			const result = await handleGetPromptLineage(channel, 'unknown')
			return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
		},
	)

	server.tool(
		'get_loop_insights',
		'Get aggregated loop intelligence insights over a time period',
		{ days: z.number().int().min(1).max(90).default(7) },
		async ({ days }) => {
			const result = await handleGetLoopInsights(days, 'unknown')
			return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
		},
	)

	return server
}
