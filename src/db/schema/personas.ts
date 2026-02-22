import { pgTable, text, timestamp, uuid, jsonb, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const personaProfiles = pgTable('persona_profiles', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	description: text('description'),
	oceanScores: jsonb('ocean_scores').default({}).notNull(),
	demographics: jsonb('demographics').default({}).notNull(),
	motivations: jsonb('motivations').default([]).notNull(),
	painPoints: jsonb('pain_points').default([]).notNull(),
	preferredChannels: jsonb('preferred_channels').default([]).notNull(),
	derivation: text('derivation'),
	metadata: jsonb('metadata').default({}).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_personas_tenant').on(table.tenantId),
])
