import { describe, it, expect, vi } from 'vitest'
import { getMcpToolNames } from '../../src/mcp/server'
import { handleScoreLead } from '../../src/mcp/tools/accounts'
import { handleGenerateWorkflow } from '../../src/mcp/tools/workflows'
import { emitEvent } from '../../src/routes/sse'
import { deduplicateArticles } from '../../src/services/scraper/dedup'
import { parseCronSchedule, isDue } from '../../src/services/scraper/feed-manager'
import { enrichArticles } from '../../src/services/scraper/enrichment'
import type { LLMProvider } from '../../src/adapters/llm/types'

describe('Phase 6 Integration: MCP + SSE + Pipeline', () => {
	it('MCP server exposes all 11 intelligence tools', () => {
		const names = getMcpToolNames()
		expect(names).toHaveLength(11)
		expect(names).toEqual(expect.arrayContaining([
			'get_sentiment_analysis', 'get_hot_accounts', 'generate_persona',
			'score_lead', 'get_experiment_allocation', 'get_competitive_intel',
			'audit_brand_content', 'generate_workflow',
			'get_loop_status', 'get_prompt_lineage', 'get_loop_insights',
		]))
	})

	it('lead scoring produces reasonable scores from signals', async () => {
		const highIntent = await handleScoreLead({ company: 'HotCo', signals: ['demo_request', 'pricing_view', 'form_submit'] }, 't1')
		const lowIntent = await handleScoreLead({ company: 'ColdCo', signals: ['page_view'] }, 't1')
		expect(highIntent.score).toBeGreaterThan(lowIntent.score)
		expect(highIntent.score).toBeGreaterThanOrEqual(50)
	})

	it('workflow generation via MCP produces valid DAG', async () => {
		const provider: LLMProvider = {
			name: 'mock',
			capabilities: new Set(['text', 'json']),
			generateText: vi.fn()
				.mockResolvedValueOnce(JSON.stringify([
					{ name: 'research', description: 'Research', inputs: [], outputs: [{ name: 'data', description: 'd', required: true }] },
					{ name: 'execute', description: 'Execute', inputs: [{ name: 'data', description: 'd', required: true }], outputs: [] },
				]))
				.mockResolvedValue(JSON.stringify({ name: 'agent', description: 'desc', systemPrompt: 'sp', instructionPrompt: 'ip' })),
			generateJSON: vi.fn(),
		}
		const result = await handleGenerateWorkflow('Launch Q2 campaign', provider)
		expect(result.graph.nodes).toHaveLength(2)
		expect(result.graph.edges).toHaveLength(1)
	})

	it('SSE event formatting is correct', () => {
		const event = emitEvent('campaign_update', { campaignId: 'c1', status: 'sent' }, 'evt-1')
		expect(event).toContain('event: campaign_update')
		expect(event).toContain('id: evt-1')
		expect(event).toContain('"campaignId":"c1"')
	})

	it('full scraper pipeline: dedup + feed scheduling + enrichment', async () => {
		// Dedup
		const articles = [
			{ tenantId: 't1', source: 'web' as const, title: 'A', content: 'Content', url: null, author: null, contentHash: 'h1', metadata: {}, publishedAt: null },
			{ tenantId: 't1', source: 'rss' as const, title: 'B', content: 'Content', url: null, author: null, contentHash: 'h1', metadata: {}, publishedAt: null },
			{ tenantId: 't1', source: 'web' as const, title: 'C', content: 'Different', url: null, author: null, contentHash: 'h2', metadata: {}, publishedAt: null },
		]
		expect(deduplicateArticles(articles)).toHaveLength(2)

		// Feed scheduling
		expect(parseCronSchedule('0 */12 * * *')).toBe(12 * 3600000)
		expect(isDue({ id: 'f1', schedule: '0 */6 * * *', active: true, lastFetchedAt: null })).toBe(true)

		// Enrichment
		const provider: LLMProvider = {
			name: 'mock',
			capabilities: new Set(['text', 'json']),
			generateText: vi.fn(),
			generateJSON: vi.fn().mockResolvedValue({ score: 0.9, themes: ['growth'] }),
		}
		const { results: enriched } = await enrichArticles(provider, [{ id: 'a1', title: 'Growth', content: 'Revenue grew 40%', brand: 'TestCo' }])
		expect(enriched[0].sentiment.score).toBe(0.9)
	})
})
