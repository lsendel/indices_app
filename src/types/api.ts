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
