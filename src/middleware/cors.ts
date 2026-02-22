import { cors } from 'hono/cors'

export function corsMiddleware() {
	const origins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
		.split(',')
		.map((o) => o.trim())
	return cors({
		origin: origins,
		allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
		allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
		credentials: true,
	})
}
