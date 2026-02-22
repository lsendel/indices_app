import { Hono } from 'hono'
import { requestId } from './middleware/request-id'
import { errorHandler } from './middleware/error-handler'
import { corsMiddleware } from './middleware/cors'
import { registerRoutes } from './routes'

export type AppEnv = {
	Variables: {
		requestId: string
		userId?: string
		tenantId?: string
	}
}

export function createApp() {
	const app = new Hono<AppEnv>()

	// Global middleware
	app.use('*', requestId())
	app.use('*', corsMiddleware())

	// Error handler
	app.onError(errorHandler)

	// Health check
	app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

	// API routes
	registerRoutes(app)

	// 404 handler
	app.notFound((c) =>
		c.json({ error: 'NOT_FOUND', message: `Route ${c.req.method} ${c.req.path} not found` }, 404),
	)

	return app
}
