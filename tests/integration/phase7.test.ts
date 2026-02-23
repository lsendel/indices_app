import { describe, it, expect } from 'vitest'
import { createLLMRouter, type LLMProvider } from '../../src/adapters/llm'
import { generateForChannel, SUPPORTED_CHANNELS, type ContentBrief } from '../../src/adapters/channels'

function mockProvider(name: string): LLMProvider {
	return {
		name,
		capabilities: new Set(['text', 'json']),
		async generateText() { return 'generated' },
		async generateJSON() {
			// Return minimal valid data for any channel schema —
			// Zod strips extra fields so a "super-object" works for all schemas.
			return {
				subject: 'Test', preheader: 'Pre', bodyHtml: '<p>Hi</p>',
				bodyText: 'Hi', cta: { text: 'Click', url: 'https://x.com' },
				message: 'Test SMS', parts: 1,
				script: 'Test script', duration: 30, tone: 'friendly',
				text: 'Social post', hashtags: ['#test'], mediaPrompt: 'photo',
				shots: [{ type: 'hook', seconds: '0-3', visual: 'Logo', audio: 'Music' }],
				captions: 'Test', thumbnailConcept: 'Product shot',
				title: 'Test Video', description: 'Desc', tags: ['test'],
				chapters: [{ timestamp: '0:00', title: 'Intro' }],
				buttons: [{ text: 'Learn More', url: 'https://x.com' }],
			}
		},
	}
}

describe('Phase 7 integration: multi-provider content generation', () => {
	const brief: ContentBrief = {
		goal: 'Drive demo signups',
		product: 'B2B Marketing SaaS',
		audience: 'CMOs at mid-market companies',
		tone: 'Professional yet approachable',
		keywords: ['marketing', 'automation', 'ROI'],
	}

	it('should route email content to claude', () => {
		const router = createLLMRouter(
			{ openai: mockProvider('openai'), claude: mockProvider('claude') },
			{ 'content:email': 'claude' },
		)

		const provider = router.resolve('content:email')
		expect(provider.name).toBe('claude')
	})

	it('should route tiktok content to gemini', () => {
		const router = createLLMRouter(
			{ openai: mockProvider('openai'), gemini: mockProvider('gemini') },
			{ 'content:tiktok': 'gemini' },
		)

		const provider = router.resolve('content:tiktok')
		expect(provider.name).toBe('gemini')
	})

	it('should generate content for any supported channel', async () => {
		const router = createLLMRouter(
			{ openai: mockProvider('openai') },
			{},
		)

		for (const channel of SUPPORTED_CHANNELS) {
			const result = await generateForChannel(channel, brief, router)
			expect(result).toBeDefined()
		}
	})

	it('should support batch generation across multiple channels', async () => {
		const router = createLLMRouter(
			{ openai: mockProvider('openai') },
			{},
		)

		const channels = ['email', 'sms', 'linkedin'] as const
		const results: Record<string, unknown> = {}

		await Promise.all(
			channels.map(async (ch) => {
				results[ch] = await generateForChannel(ch, brief, router)
			}),
		)

		expect(Object.keys(results)).toHaveLength(3)
		expect(results.email).toBeDefined()
		expect(results.sms).toBeDefined()
		expect(results.linkedin).toBeDefined()
	})
})
