import { z } from 'zod'

// Prospects
export const prospectCreate = z.object({
	name: z.string().min(1).max(100),
	company: z.string().min(1).max(100),
	role: z.string().min(1).max(100),
	email: z.string().email().optional(),
	phone: z
		.string()
		.regex(/^\+?[1-9]\d{1,14}$/)
		.optional(),
	linkedinId: z.string().optional(),
	notes: z.string().max(1000).optional(),
})

export const prospectUpdate = prospectCreate.partial()

export type ProspectCreate = z.infer<typeof prospectCreate>
export type ProspectUpdate = z.infer<typeof prospectUpdate>

// Campaigns
export const campaignCreate = z.object({
	name: z.string().min(1).max(200),
	goal: z.string().min(1).max(200),
	productDescription: z.string().max(500).optional(),
	channels: z.array(z.enum(['email', 'sms', 'voice', 'linkedin'])).min(1),
	prospectId: z.string().uuid().optional(),
	metadata: z.record(z.string(), z.any()).optional(),
})

export type CampaignCreate = z.infer<typeof campaignCreate>

// Segments
export const segmentCreate = z.object({
	name: z.string().min(1).max(100),
	description: z.string().max(500).optional(),
	rules: z.record(z.string(), z.any()).default({}),
	active: z.boolean().default(true),
})

export type SegmentCreate = z.infer<typeof segmentCreate>

// Pagination
export const paginationQuery = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(25),
})

// Signals
export const signalCapture = z.object({
	accountId: z.string().min(1),
	signalType: z.enum(['page_view', 'email_open', 'email_click', 'form_submit', 'demo_request', 'pricing_view', 'content_download', 'social_mention', 'competitor_visit', 'custom']),
	signalSource: z.string().min(1),
	strength: z.number().int().min(1).max(100),
	signalData: z.record(z.string(), z.any()).default({}),
})

export type SignalCapture = z.infer<typeof signalCapture>

// Accounts (ABM)
export const accountCreate = z.object({
	company: z.string().min(1).max(200),
	domain: z.string().optional(),
	industry: z.string().optional(),
	size: z.enum(['1-10', '11-50', '51-200', '201-1000', '1001-5000', '5000+']).optional(),
	tier: z.enum(['enterprise', 'mid_market', 'smb', 'startup']).default('smb'),
	metadata: z.record(z.string(), z.any()).optional(),
})

export type AccountCreate = z.infer<typeof accountCreate>

// Deals
export const dealCreate = z.object({
	accountId: z.string().uuid(),
	name: z.string().min(1).max(200),
	value: z.number().positive(),
	stage: z.enum(['discovery', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost']).default('discovery'),
	probability: z.number().int().min(0).max(100).default(0),
	expectedCloseDate: z.string().datetime().optional(),
	metadata: z.record(z.string(), z.any()).optional(),
})

export type DealCreate = z.infer<typeof dealCreate>

// Experiments
export const experimentCreate = z.object({
	name: z.string().min(1).max(200),
	type: z.enum(['ab_test', 'mab_thompson', 'mab_ucb', 'mab_epsilon']).default('mab_thompson'),
	targetMetric: z.string().min(1),
})

export type ExperimentCreate = z.infer<typeof experimentCreate>

export const armCreate = z.object({
	variantName: z.string().min(1),
	content: z.record(z.string(), z.any()).default({}),
})

export type ArmCreate = z.infer<typeof armCreate>

export const armReward = z.object({
	armId: z.string().uuid(),
	success: z.boolean(),
})

export type ArmReward = z.infer<typeof armReward>

// Personas
export const personaCreate = z.object({
	name: z.string().min(1).max(100),
	description: z.string().optional(),
	oceanScores: z.object({
		openness: z.number().min(0).max(1),
		conscientiousness: z.number().min(0).max(1),
		extraversion: z.number().min(0).max(1),
		agreeableness: z.number().min(0).max(1),
		neuroticism: z.number().min(0).max(1),
	}),
	demographics: z.record(z.string(), z.any()).default({}),
	motivations: z.array(z.string()).default([]),
	painPoints: z.array(z.string()).default([]),
	preferredChannels: z.array(z.string()).default([]),
})

export type PersonaCreate = z.infer<typeof personaCreate>

// Brand Kits
export const brandKitCreate = z.object({
	name: z.string().min(1).max(100),
	brandName: z.string().min(1).max(100),
	colors: z.array(z.record(z.string(), z.any())).default([]),
	typography: z.array(z.record(z.string(), z.any())).default([]),
	voiceAttributes: z.record(z.string(), z.any()).default({}),
	logoRules: z.array(z.record(z.string(), z.any())).default([]),
	colorTolerance: z.number().int().min(0).max(255).default(50),
})

export type BrandKitCreate = z.infer<typeof brandKitCreate>

// Zeluto sync
export const zelutoConfigCreate = z.object({
	organizationId: z.string().min(1),
	userId: z.string().min(1),
	userRole: z.enum(['owner', 'admin', 'member', 'viewer']).default('admin'),
	plan: z.enum(['free', 'starter', 'pro', 'enterprise']).default('pro'),
	webhookSecret: z.string().optional(),
})

export const contentSyncRequest = z.object({
	name: z.string().min(1),
	channel: z.enum(['email', 'sms', 'voice', 'linkedin']),
	subject: z.string().optional(),
	bodyHtml: z.string().optional(),
	bodyText: z.string().optional(),
})

export const contactSyncRequest = z.object({
	prospectIds: z.array(z.string().uuid()).min(1).max(100),
})

export const campaignSyncRequest = z.object({
	campaignId: z.string().uuid(),
	action: z.enum(['create', 'send', 'schedule']).default('create'),
	scheduledAt: z.string().optional(),
})

export const experimentSyncRequest = z.object({
	experimentId: z.string().uuid(),
	zelutoCampaignId: z.number().int().positive(),
	winningCriteria: z.enum(['opens', 'clicks', 'conversions']).default('clicks'),
})

// Workflows (Phase 4)
export const workflowCreate = z.object({
	goal: z.string().min(1).max(500),
	campaignId: z.string().uuid().optional(),
	metadata: z.record(z.string(), z.any()).optional(),
})

export type WorkflowCreate = z.infer<typeof workflowCreate>

// HITL
export const hitlDecision = z.object({
	decision: z.enum(['approved', 'rejected', 'modified']),
	modifications: z.record(z.string(), z.any()).optional(),
})

export type HitlDecision = z.infer<typeof hitlDecision>

// Evolution
export const evolutionStart = z.object({
	agentConfigId: z.string().uuid(),
	strategy: z.enum(['textgrad', 'ga', 'de', 'hybrid']).default('hybrid'),
	populationSize: z.number().int().min(2).max(20).default(5),
	generations: z.number().int().min(1).max(50).default(10),
})

export type EvolutionStart = z.infer<typeof evolutionStart>

// Prompt versions
export const promptVersionCreate = z.object({
	agentConfigId: z.string().uuid(),
	systemPrompt: z.string().min(1),
	instructionPrompt: z.string().min(1),
})

export type PromptVersionCreate = z.infer<typeof promptVersionCreate>

// Feed subscriptions (Phase 5)
export const feedSubscriptionCreate = z.object({
	name: z.string().min(1).max(200),
	feedUrl: z.string().url(),
	feedType: z.enum(['rss', 'atom', 'news']).default('rss'),
	schedule: z.string().default('0 */6 * * *'),
	keywords: z.string().optional(),
	maxItems: z.number().int().min(1).max(500).default(50),
})

export type FeedSubscriptionCreate = z.infer<typeof feedSubscriptionCreate>

export const feedSubscriptionUpdate = feedSubscriptionCreate.partial().extend({
	active: z.boolean().optional(),
})

export type FeedSubscriptionUpdate = z.infer<typeof feedSubscriptionUpdate>

// Batch payload (Phase 5 — Rust worker callback)
export const batchPayload = z.object({
	job_id: z.string(),
	batch_index: z.number().int().min(0),
	is_final: z.boolean(),
	tenant_id: z.string().optional(),
	pages: z.array(z.object({
		url: z.string(),
		title: z.string(),
		content: z.string().optional(),
		author: z.string().optional(),
		content_hash: z.string().optional(),
	})).optional(),
	posts: z.array(z.object({
		platform: z.string(),
		title: z.string().optional(),
		content: z.string().optional(),
		author: z.string().optional(),
		url: z.string().optional(),
		engagement: z.record(z.string(), z.unknown()).optional(),
		posted_at: z.string().optional(),
	})).optional(),
})

export type BatchPayload = z.infer<typeof batchPayload>

// Scrape job dispatch (Phase 5)
const webCrawlJob = z.object({
	jobType: z.literal('web_crawl'),
	seedUrls: z.array(z.string().url()).min(1),
	keywords: z.array(z.string()).optional(),
	maxPages: z.number().int().min(1).max(1000).default(100),
})

const socialScrapeJob = z.object({
	jobType: z.literal('social_scrape'),
	subreddits: z.array(z.string()).min(1),
	keywords: z.array(z.string()).optional(),
	maxPages: z.number().int().min(1).max(1000).default(100),
})

const feedIngestJob = z.object({
	jobType: z.literal('feed_ingest'),
	feedSubscriptionId: z.string().uuid(),
	maxPages: z.number().int().min(1).max(1000).default(100),
})

export const scrapeJobDispatch = z.discriminatedUnion('jobType', [
	webCrawlJob,
	socialScrapeJob,
	feedIngestJob,
])

export type ScrapeJobDispatch = z.infer<typeof scrapeJobDispatch>

export const scrapeJobCancel = z.object({
	jobId: z.string().uuid(),
})

export type ScrapeJobCancel = z.infer<typeof scrapeJobCancel>
