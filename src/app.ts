import { Hono } from 'hono'
import { requestId } from './middleware/request-id'
import { errorHandler } from './middleware/error-handler'
import { corsMiddleware } from './middleware/cors'
import { registerRoutes } from './routes'
import { createDb, type Database } from './db/client'
import { createAuth } from './auth'
import { landingPage, loginPage, dashboardPage } from './pages'

export type Bindings = {
	ENVIRONMENT: string
	DATABASE_URL: string
	BETTER_AUTH_SECRET: string
	BETTER_AUTH_URL: string
	OPENAI_API_KEY?: string
	OPENAI_MODEL?: string
	ANTHROPIC_API_KEY?: string
	GEMINI_API_KEY?: string
	PERPLEXITY_API_KEY?: string
	GROK_API_KEY?: string
	HUGGINGFACE_API_KEY?: string
	CORS_ORIGINS: string
	SENDGRID_API_KEY?: string
	TWILIO_ACCOUNT_SID?: string
	TWILIO_AUTH_TOKEN?: string
	TWILIO_FROM_NUMBER?: string
	SCRAPER_WORKER_URL?: string
	SCRAPER_SHARED_SECRET?: string
	ZELUTO_API_URL?: string
	ZELUTO_TENANT_CONTEXT?: string
	ZELUTO_API_KEY?: string
	ZELUTO_WEBHOOK_SECRET?: string
	META_APP_ID?: string
	META_APP_SECRET?: string
	TIKTOK_CLIENT_KEY?: string
	TIKTOK_CLIENT_SECRET?: string
	LINKEDIN_CLIENT_ID?: string
	LINKEDIN_CLIENT_SECRET?: string
	GOOGLE_CLIENT_ID?: string
	GOOGLE_CLIENT_SECRET?: string
	REDIS_URL?: string
}

export type AppEnv = {
	Bindings: Bindings
	Variables: {
		requestId: string
		userId?: string
		tenantId?: string
		user?: import('./middleware/auth').SessionUser
		db: Database
	}
}

export function createApp() {
	const app = new Hono<AppEnv>()

	// Normalize env — CF Workers always provides bindings, but
	// Bun/tests may leave c.env undefined
	app.use('*', async (c, next) => {
		if (!c.env) {
			(c as any).env = {}
		}
		const dbUrl = c.env.DATABASE_URL || process.env.DATABASE_URL
		if (dbUrl) {
			c.set('db', createDb(dbUrl))
		}
		await next()
	})

	// Global middleware
	app.use('*', requestId())
	app.use('*', corsMiddleware())

	// Error handler
	app.onError(errorHandler)

	// Health check
	app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

	// Frontend pages (served on indices.app)
	app.get('/', (c) => c.html(landingPage()))
	app.get('/login', (c) => c.html(loginPage()))
	app.get('/dashboard', (c) => c.html(dashboardPage()))

	// Better Auth handler (Google OAuth, session management)
	app.on(['POST', 'GET'], '/api/auth/*', async (c) => {
		const origin = new URL(c.req.url).origin
		const auth = createAuth(c.var.db, c.env, origin)
		try {
			return await auth.handler(c.req.raw)
		} catch (err) {
			console.error('AUTH_ERROR:', err)
			throw err
		}
	})

	// API routes
	registerRoutes(app)

	// 404 handler
	app.notFound((c) =>
		c.json({ error: 'NOT_FOUND', message: `Route ${c.req.method} ${c.req.path} not found` }, 404),
	)

	return app
}
