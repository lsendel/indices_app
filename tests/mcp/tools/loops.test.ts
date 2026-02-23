import { describe, it, expect } from 'vitest'
import { handleGetLoopStatus, handleGetLoopInsights, handleGetPromptLineage } from '../../../src/mcp/tools/loops'

describe('Loop MCP tools', () => {
	it('getLoopStatus returns structured status', async () => {
		const result = await handleGetLoopStatus('tenant-1')
		expect(result).toHaveProperty('pipelines')
		expect(result).toHaveProperty('activeRules')
	})

	it('getPromptLineage returns versions array', async () => {
		const result = await handleGetPromptLineage('email', 'tenant-1')
		expect(result).toHaveProperty('channel')
		expect(result).toHaveProperty('versions')
	})

	it('getLoopInsights returns summary', async () => {
		const result = await handleGetLoopInsights(7, 'tenant-1')
		expect(result).toHaveProperty('period')
		expect(result).toHaveProperty('summary')
	})
})
