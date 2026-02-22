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

export function registerRoutes(app: Hono<AppEnv>) {
	// Protected API routes
	app.use('/api/v1/*', authMiddleware())
	app.route('/api/v1/prospects', createProspectRoutes())
	app.route('/api/v1/campaigns', createCampaignRoutes())
	app.route('/api/v1/segments', createSegmentRoutes())
	app.route('/api/v1/audit', createComplianceRoutes())
	app.route('/api/v1/ingest', createIngestRoutes())
	app.route('/api/v1/signals', createSignalRoutes())
	app.route('/api/v1/accounts', createAbmRoutes())
}
