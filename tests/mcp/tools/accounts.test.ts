import { describe, it, expect, vi } from 'vitest'
import { handleGetHotAccounts, handleScoreLead } from '../../../src/mcp/tools/accounts'

vi.mock('../../../src/db/client', () => ({
	getDb: vi.fn().mockReturnValue({
		select: vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					orderBy: vi.fn().mockReturnValue({
						limit: vi.fn().mockResolvedValue([
							{ id: 'acc-1', company: 'HotCo', score: 85 },
						]),
					}),
				}),
			}),
		}),
	}),
}))

describe('handleGetHotAccounts', () => {
	it('returns accounts above intent threshold', async () => {
		const result = await handleGetHotAccounts(70, 10, 'tenant-1')
		expect(result.accounts).toHaveLength(1)
		expect(result.accounts[0].company).toBe('HotCo')
	})
})

describe('handleScoreLead', () => {
	it('returns a lead score', async () => {
		const result = await handleScoreLead({ company: 'TestCo', signals: ['demo_request'] }, 'tenant-1')
		expect(result.score).toBeGreaterThanOrEqual(0)
		expect(result.score).toBeLessThanOrEqual(100)
	})
})
