import { describe, it, expect, vi } from 'vitest'
import { handleGetLoopStatus, handleGetLoopInsights, handleGetPromptLineage } from '../../../src/mcp/tools/loops'

const loopChain: any = { then: (resolve: any) => resolve([]) }
loopChain.where = vi.fn().mockReturnValue(loopChain)
loopChain.orderBy = vi.fn().mockReturnValue(loopChain)
loopChain.limit = vi.fn().mockReturnValue(loopChain)

const countChain: any = { then: (resolve: any) => resolve([{ count: 0 }]) }
countChain.where = vi.fn().mockReturnValue(countChain)

const mockDb = {
	select: vi.fn().mockImplementation((fields?: any) => {
		const isCount = fields && 'count' in (fields || {})
		return {
			from: vi.fn().mockReturnValue(isCount ? countChain : loopChain),
		}
	}),
} as any

describe('Loop MCP tools', () => {
	it('getLoopStatus returns structured status from DB', async () => {
		const result = await handleGetLoopStatus(mockDb, 'tenant-1')
		expect(result).toHaveProperty('pipelines')
		expect(result).toHaveProperty('activeRules')
		expect(result).toHaveProperty('recentEvents')
		expect(result).toHaveProperty('channelGroups')
	})

	it('getPromptLineage returns versions array from DB', async () => {
		const result = await handleGetPromptLineage(mockDb, 'email', 'tenant-1')
		expect(result).toHaveProperty('channel', 'email')
		expect(result).toHaveProperty('versions')
		expect(result.versions).toBeInstanceOf(Array)
	})

	it('getLoopInsights returns summary from DB', async () => {
		const result = await handleGetLoopInsights(mockDb, 7, 'tenant-1')
		expect(result).toHaveProperty('period', '7 days')
		expect(result).toHaveProperty('summary')
		expect(result).toHaveProperty('totalEvents')
		expect(result.summary).toContain('No loop activity')
	})
})
