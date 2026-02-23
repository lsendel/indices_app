import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { generateForChannel } from '../../../src/adapters/channels/generator'
import type { LLMRouter } from '../../../src/adapters/llm'
import type { ContentBrief } from '../../../src/adapters/channels/config'

function mockRouter(): LLMRouter {
	return {
		resolve: vi.fn().mockReturnValue({
			name: 'mock',
			capabilities: new Set(['text', 'json']),
			generateText: vi.fn().mockResolvedValue('generated text'),
			generateJSON: vi.fn().mockImplementation((_prompt: string, schema: z.ZodType) => {
				return Promise.resolve({
					subject: 'Test Subject',
					preheader: 'Test preheader',
					bodyHtml: '<p>Hello</p>',
					bodyText: 'Hello',
					cta: { text: 'Click', url: 'https://example.com' },
				})
			}),
		}),
		listProviders: vi.fn().mockReturnValue([]),
	}
}

const testBrief: ContentBrief = {
	goal: 'Drive signups',
	product: 'Marketing tool',
	audience: 'B2B marketers',
	tone: 'Professional',
}

describe('generateForChannel', () => {
	it('should resolve the correct provider for the channel', async () => {
		const router = mockRouter()
		await generateForChannel('email', testBrief, router)
		expect(router.resolve).toHaveBeenCalledWith('content:email')
	})

	it('should include channel constraints in the prompt', async () => {
		const router = mockRouter()
		const provider = router.resolve('content:email')
		await generateForChannel('email', testBrief, router)
		expect(provider.generateJSON).toHaveBeenCalledWith(
			expect.stringContaining('subject'),
			expect.anything(),
			expect.anything(),
		)
	})

	it('should include brief details in the prompt', async () => {
		const router = mockRouter()
		const provider = router.resolve('content:email')
		await generateForChannel('email', testBrief, router)
		expect(provider.generateJSON).toHaveBeenCalledWith(
			expect.stringContaining('Drive signups'),
			expect.anything(),
			expect.anything(),
		)
	})

	it('should throw for unsupported channel', async () => {
		const router = mockRouter()
		await expect(
			generateForChannel('carrier_pigeon' as any, testBrief, router),
		).rejects.toThrow('Unsupported channel')
	})

	it('should allow provider override', async () => {
		const router = mockRouter()
		await generateForChannel('email', testBrief, router, 'claude')
		expect(router.resolve).toHaveBeenCalledWith('content:email')
	})
})
