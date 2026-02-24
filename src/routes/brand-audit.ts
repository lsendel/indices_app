import { Hono } from 'hono'
import { validate } from '../middleware/validate'
import { eq, and, desc } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { brandKits } from '../db/schema'
import { brandKitCreate } from '../types/api'
import { NotFoundError } from '../types/errors'
import { createLLMRouterFromConfig } from '../adapters/llm/factory'

export function createBrandAuditRoutes() {
	const router = new Hono<AppEnv>()

	// List brand kits
	router.get('/', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!

		const items = await db
			.select()
			.from(brandKits)
			.where(eq(brandKits.tenantId, tenantId))
			.orderBy(desc(brandKits.createdAt))

		return c.json({ items })
	})

	// Create brand kit
	router.post('/', validate('json', brandKitCreate), async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')

		const [created] = await db.insert(brandKits).values({ ...data, tenantId }).returning()
		return c.json(created, 201)
	})

	// Get brand kit detail
	router.get('/:id', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')

		const [kit] = await db
			.select()
			.from(brandKits)
			.where(and(eq(brandKits.id, id), eq(brandKits.tenantId, tenantId)))
		if (!kit) throw new NotFoundError('BrandKit', id)

		return c.json(kit)
	})

	// Audit content against brand kit
	router.post('/:id/audit', async (c) => {
		const id = c.req.param('id')
		const db = c.var.db
		const tenantId = c.get('tenantId')!

		const [kit] = await db
			.select()
			.from(brandKits)
			.where(and(eq(brandKits.id, id), eq(brandKits.tenantId, tenantId)))
		if (!kit) throw new NotFoundError('BrandKit', id)

		const body = await c.req.json()
		const content = body.content ?? ''
		const voiceAttributes = (kit.voiceAttributes ?? {}) as Record<string, unknown>

		// Try LLM-based audit if a provider is available
		let auditResult: { compliant: boolean; issues: string[] } = { compliant: true, issues: [] }
		try {
			const config = {
				OPENAI_API_KEY: c.env.OPENAI_API_KEY,
				OPENAI_MODEL: c.env.OPENAI_MODEL || 'gpt-4o-mini',
				ANTHROPIC_API_KEY: c.env.ANTHROPIC_API_KEY,
			} as any
			const router = createLLMRouterFromConfig(config)
			const provider = router.resolve('analysis:sentiment')

			const prompt = `Audit this content against brand guidelines.
Brand: ${kit.brandName}
Voice: ${JSON.stringify(voiceAttributes)}
Content: ${content}

Return JSON: { "compliant": boolean, "issues": ["issue1", ...] }`

			const response = await provider.generateText(prompt, {
				systemPrompt: 'You audit marketing content against brand guidelines. Return JSON only.',
			})
			auditResult = JSON.parse(response)
		} catch {
			// No LLM available — do basic keyword check
			const tone = (voiceAttributes.tone as string) ?? ''
			if (tone && !content.toLowerCase().includes(tone.toLowerCase())) {
				auditResult.issues.push(`Content may not match expected tone: "${tone}"`)
				auditResult.compliant = false
			}
		}

		return c.json({
			kitId: id,
			brandName: kit.brandName,
			content: content.slice(0, 200),
			...auditResult,
		})
	})

	return router
}
