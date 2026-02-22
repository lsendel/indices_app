import { z } from 'zod'

// --- Tenant Context ---
export const zelutoTenantContext = z.object({
	organizationId: z.string().min(1),
	userId: z.string().min(1),
	userRole: z.enum(['owner', 'admin', 'member', 'viewer']),
	plan: z.enum(['free', 'starter', 'pro', 'enterprise']),
})
export type ZelutoTenantContext = z.infer<typeof zelutoTenantContext>

// --- Templates ---
export const zelutoTemplateCreate = z.object({
	name: z.string().min(1),
	type: z.enum(['email', 'sms', 'push', 'page']),
	category: z.string().optional(),
	subject: z.string().optional(),
	bodyHtml: z.string().optional(),
	bodyText: z.string().optional(),
	bodyJson: z.record(z.string(), z.unknown()).optional(),
	isActive: z.boolean().optional(),
})
export type ZelutoTemplateCreate = z.infer<typeof zelutoTemplateCreate>

export const zelutoTemplate = z.object({
	id: z.number(),
	name: z.string(),
	type: z.enum(['email', 'sms', 'push', 'page']),
	category: z.string().nullable(),
	subject: z.string().nullable(),
	bodyHtml: z.string().nullable(),
	bodyText: z.string().nullable(),
	bodyJson: z.record(z.string(), z.unknown()).nullable(),
	thumbnailUrl: z.string().nullable(),
	isActive: z.boolean(),
	createdBy: z.number(),
	createdAt: z.string(),
	updatedAt: z.string(),
})
export type ZelutoTemplate = z.infer<typeof zelutoTemplate>

// --- Campaigns ---
export const zelutoCampaignCreate = z.object({
	name: z.string().min(1),
	description: z.string().optional(),
	type: z.enum(['email', 'sms', 'push', 'multichannel']),
})
export type ZelutoCampaignCreate = z.infer<typeof zelutoCampaignCreate>

export const zelutoCampaign = z.object({
	id: z.number(),
	name: z.string(),
	description: z.string().nullable(),
	type: z.enum(['email', 'sms', 'push', 'multichannel']),
	status: z.enum(['draft', 'scheduled', 'sending', 'sent', 'paused', 'canceled']),
	scheduledAt: z.string().nullable(),
	startedAt: z.string().nullable(),
	completedAt: z.string().nullable(),
	createdBy: z.number(),
	createdAt: z.string(),
	updatedAt: z.string(),
})
export type ZelutoCampaign = z.infer<typeof zelutoCampaign>

export const zelutoCampaignStats = z.object({
	id: z.number(),
	campaignId: z.number(),
	totalRecipients: z.number(),
	sent: z.number(),
	delivered: z.number(),
	opened: z.number(),
	clicked: z.number(),
	bounced: z.number(),
	complained: z.number(),
	unsubscribed: z.number(),
})
export type ZelutoCampaignStats = z.infer<typeof zelutoCampaignStats>

// --- Contacts ---
export const zelutoContactCreate = z.object({
	email: z.string().email().optional(),
	firstName: z.string().optional(),
	lastName: z.string().optional(),
	phone: z.string().optional(),
	companyId: z.number().optional(),
	tags: z.array(z.string()).optional(),
	customFields: z.record(z.string(), z.unknown()).optional(),
})
export type ZelutoContactCreate = z.infer<typeof zelutoContactCreate>

export const zelutoContact = z.object({
	id: z.number(),
	email: z.string().nullable(),
	firstName: z.string().nullable(),
	lastName: z.string().nullable(),
	phone: z.string().nullable(),
	companyId: z.number().nullable(),
	tags: z.array(z.string()),
	customFields: z.record(z.string(), z.unknown()),
	createdAt: z.string(),
	updatedAt: z.string(),
})
export type ZelutoContact = z.infer<typeof zelutoContact>

export const zelutoContactImportResult = z.object({
	imported: z.number(),
	failed: z.number(),
	errors: z.array(
		z.object({
			index: z.number(),
			error: z.string(),
		}),
	),
})
export type ZelutoContactImportResult = z.infer<typeof zelutoContactImportResult>

// --- A/B Tests ---
export const zelutoAbTestCreate = z.object({
	campaignId: z.number(),
	name: z.string().min(1),
	variants: z.array(z.record(z.string(), z.unknown())),
	winningCriteria: z.enum(['opens', 'clicks', 'conversions']),
})
export type ZelutoAbTestCreate = z.infer<typeof zelutoAbTestCreate>

export const zelutoAbTest = z.object({
	id: z.number(),
	campaignId: z.number(),
	name: z.string(),
	variants: z.array(z.record(z.string(), z.unknown())),
	winningCriteria: z.enum(['opens', 'clicks', 'conversions']),
	winnerVariant: z.number().nullable(),
	status: z.enum(['running', 'completed', 'canceled']),
	createdAt: z.string(),
	updatedAt: z.string(),
})
export type ZelutoAbTest = z.infer<typeof zelutoAbTest>

// --- Delivery Events ---
export const zelutoDeliveryEvent = z.object({
	id: z.string(),
	jobId: z.string(),
	contactId: z.number(),
	channel: z.enum(['email', 'sms', 'push', 'webhook']),
	eventType: z.enum([
		'queued',
		'sent',
		'delivered',
		'opened',
		'clicked',
		'bounced',
		'complained',
		'unsubscribed',
		'failed',
	]),
	providerMessageId: z.string().nullable(),
	createdAt: z.string(),
})
export type ZelutoDeliveryEvent = z.infer<typeof zelutoDeliveryEvent>

// --- Webhook Callback ---
export const zelutoWebhookEvent = z.object({
	eventType: z.string(),
	payload: z.record(z.string(), z.unknown()),
})
export type ZelutoWebhookEvent = z.infer<typeof zelutoWebhookEvent>

// --- Webhook Registration ---
export const zelutoWebhookCreate = z.object({
	url: z.string().url(),
	events: z.array(z.string()),
	isActive: z.boolean().optional(),
	secret: z.string().optional(),
})
export type ZelutoWebhookCreate = z.infer<typeof zelutoWebhookCreate>

export const zelutoWebhook = z.object({
	id: z.number(),
	url: z.string(),
	events: z.array(z.string()),
	isActive: z.boolean(),
	secret: z.string().nullable(),
	lastTriggeredAt: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
})
export type ZelutoWebhook = z.infer<typeof zelutoWebhook>

// --- Error ---
export const zelutoErrorResponse = z.object({
	code: z.string(),
	message: z.string(),
	details: z.record(z.string(), z.unknown()).optional(),
})
export type ZelutoErrorResponse = z.infer<typeof zelutoErrorResponse>
