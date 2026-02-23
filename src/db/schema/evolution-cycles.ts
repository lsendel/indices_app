import { pgTable, text, timestamp, uuid, integer, real, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'
import { agentConfigs } from './agent-configs'

export const evolutionCycles = pgTable('evolution_cycles', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	agentConfigId: uuid('agent_config_id').references(() => agentConfigs.id),
	generation: integer('generation').notNull(),
	strategy: text('strategy', { enum: ['textgrad', 'ga', 'de', 'hybrid'] }).notNull(),
	populationSize: integer('population_size').default(5).notNull(),
	generations: integer('generations').default(10).notNull(),
	status: text('status', { enum: ['pending', 'running', 'completed', 'failed'] }).default('pending').notNull(),
	bestScore: real('best_score'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => [
	index('idx_evolution_cycles_tenant').on(table.tenantId),
	index('idx_evolution_cycles_status').on(table.status),
])

export const evolutionCandidates = pgTable('evolution_candidates', {
	id: uuid('id').defaultRandom().primaryKey(),
	cycleId: uuid('cycle_id').notNull().references(() => evolutionCycles.id, { onDelete: 'cascade' }),
	prompt: text('prompt').notNull(),
	score: real('score'),
	parentIds: text('parent_ids'),
	mutationStrategy: text('mutation_strategy', { enum: ['crossover', 'mutation', 'de_mutation', 'textgrad'] }),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_evolution_candidates_cycle').on(table.cycleId),
])
