import { pgTable, text, timestamp, uuid, jsonb, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const campaigns = pgTable('campaigns', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  goal: text('goal').notNull(),
  productDescription: text('product_description'),
  status: text('status', {
    enum: ['pending', 'running', 'completed', 'partial', 'failed', 'cancelled'],
  }).default('pending').notNull(),
  channelsRequested: jsonb('channels_requested').default([]).notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
  // Creative + approval (email). Approval is human-only and bound to contentHash.
  brandKey: text('brand_key'),
  subject: text('subject'),
  previewText: text('preview_text'),
  bodyHtml: text('body_html'),
  bodyText: text('body_text'),
  audienceSpec: jsonb('audience_spec'),
  contentHash: text('content_hash'),
  approvalStatus: text('approval_status', {
    enum: ['draft', 'approved', 'rejected'],
  }).default('draft').notNull(),
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedHash: text('approved_hash'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_campaigns_tenant').on(table.tenantId),
  index('idx_campaigns_status').on(table.status),
  index('idx_campaigns_created').on(table.createdAt),
  index('idx_campaigns_approval').on(table.tenantId, table.approvalStatus),
])

export const channelResults = pgTable('channel_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  channel: text('channel', { enum: ['email', 'sms', 'voice', 'whatsapp', 'linkedin', 'facebook', 'instagram', 'tiktok', 'youtube', 'vimeo', 'video'] }).notNull(),
  status: text('status', {
    enum: ['pending', 'sent', 'queued', 'delivered', 'failed', 'skipped'],
  }).default('pending').notNull(),
  provider: text('provider'),
  messageContent: text('message_content'),
  messageSubject: text('message_subject'),
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
