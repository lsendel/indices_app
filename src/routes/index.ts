import type { Hono } from 'hono'
import type { AppEnv } from '../app'
import { authMiddleware } from '../middleware/auth'
import { createProspectRoutes } from './prospects'
import { createCampaignRoutes } from './campaigns'
import { createSegmentRoutes } from './segments'
import { createComplianceRoutes } from './compliance'
import { createIngestRoutes } from './ingest'
import { createSignalRoutes } from './signals'
import { createAbmRoutes } from './abm'
import { createSentimentRoutes } from './social-sentiment'
import { createExperimentRoutes } from './experiments'
import { createPersonaRoutes } from './personas'
import { createBrandAuditRoutes } from './brand-audit'
import { createZelutoWebhookRoutes } from './zeluto-webhook'
import { createZelutoRoutes } from './zeluto'
import { createWorkflowRoutes } from './workflows'
import { createEvolutionRoutes } from './evolution'
import { createScraperRoutes } from './scraper'

export function registerRoutes(app: Hono<AppEnv>) {
	// Webhook routes (HMAC-authenticated, no user session)
	app.route('/webhooks/zeluto', createZelutoWebhookRoutes())

	// Protected API routes
	app.use('/api/v1/*', authMiddleware())
	app.route('/api/v1/prospects', createProspectRoutes())
	app.route('/api/v1/campaigns', createCampaignRoutes())
	app.route('/api/v1/segments', createSegmentRoutes())
	app.route('/api/v1/audit', createComplianceRoutes())
	app.route('/api/v1/ingest', createIngestRoutes())
	app.route('/api/v1/signals', createSignalRoutes())
	app.route('/api/v1/accounts', createAbmRoutes())
	app.route('/api/v1/sentiment', createSentimentRoutes())
	app.route('/api/v1/experiments', createExperimentRoutes())
	app.route('/api/v1/personas', createPersonaRoutes())
	app.route('/api/v1/brand-kits', createBrandAuditRoutes())
	app.route('/api/v1/zeluto', createZelutoRoutes())
	app.route('/api/v1/workflows', createWorkflowRoutes())
	app.route('/api/v1/evolution', createEvolutionRoutes())
	app.route('/api/v1/scraper', createScraperRoutes())
}
