import { describe, it, expect } from 'vitest'
import { handleGetLoopStatus, handleGetLoopInsights, handleGetPromptLineage } from '../../../src/mcp/tools/loops'

describe('Loop MCP tools', () => {
	it('getLoopStatus returns structured status with stub marker', async () => {
		const result = await handleGetLoopStatus('tenant-1')
		expect(result).toHaveProperty('pipelines')
		expect(result).toHaveProperty('activeRules')
		expect(result.status).toBe('stub')
	})

	it('getPromptLineage returns versions array with stub marker', async () => {
		const result = await handleGetPromptLineage('email', 'tenant-1')
		expect(result).toHaveProperty('channel')
		expect(result).toHaveProperty('versions')
		expect(result.status).toBe('stub')
	})

	it('getLoopInsights returns summary with stub marker', async () => {
		const result = await handleGetLoopInsights(7, 'tenant-1')
		expect(result).toHaveProperty('period')
		expect(result).toHaveProperty('summary')
		expect(result.status).toBe('stub')
	})
})
