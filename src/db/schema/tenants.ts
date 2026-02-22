import { pgTable, text, timestamp, jsonb, integer, uuid } from 'drizzle-orm/pg-core'

export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  status: text('status', { enum: ['active', 'suspended', 'trial'] }).default('active').notNull(),
  settings: jsonb('settings').default({}).notNull(),
  maxCampaigns: integer('max_campaigns').default(100).notNull(),
  maxProspects: integer('max_prospects').default(10000).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
