import { describe, it, expect, vi } from 'vitest'
import { handleGetSentimentAnalysis, handleGetCompetitiveIntel } from '../../../src/mcp/tools/sentiment'

vi.mock('../../../src/db/client', () => ({
	getDb: vi.fn().mockReturnValue({
		select: vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([
					{ brand: 'AcmeCorp', sentimentScore: 0.7, themes: ['innovation'], createdAt: new Date() },
					{ brand: 'AcmeCorp', sentimentScore: 0.5, themes: ['pricing'], createdAt: new Date() },
				]),
			}),
		}),
	}),
}))

describe('handleGetSentimentAnalysis', () => {
	it('returns aggregated sentiment data', async () => {
		const result = await handleGetSentimentAnalysis('AcmeCorp', 30, 'tenant-1')
		expect(result.brand).toBe('AcmeCorp')
		expect(result.averageScore).toBeCloseTo(0.6, 1)
		expect(result.dataPoints).toBe(2)
	})
})

describe('handleGetCompetitiveIntel', () => {
	it('returns competitor sentiment comparison', async () => {
		const result = await handleGetCompetitiveIntel('CompetitorCo', 'tenant-1')
		expect(result.competitor).toBe('CompetitorCo')
		expect(result.sentimentData).toBeDefined()
	})
})
