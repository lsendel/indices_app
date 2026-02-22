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
