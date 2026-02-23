import { describe, it, expect } from 'vitest'
import { createMcpServer, getMcpToolNames } from '../../src/mcp/server'

describe('MCP server', () => {
	it('creates an MCP server instance', () => {
		const server = createMcpServer()
		expect(server).toBeDefined()
	})

	it('registers all 11 intelligence tools', () => {
		const names = getMcpToolNames()
		expect(names).toContain('get_sentiment_analysis')
		expect(names).toContain('get_hot_accounts')
		expect(names).toContain('generate_persona')
		expect(names).toContain('score_lead')
		expect(names).toContain('get_experiment_allocation')
		expect(names).toContain('get_competitive_intel')
		expect(names).toContain('audit_brand_content')
		expect(names).toContain('generate_workflow')
		expect(names).toContain('get_loop_status')
		expect(names).toContain('get_prompt_lineage')
		expect(names).toContain('get_loop_insights')
		expect(names).toHaveLength(11)
	})
})
