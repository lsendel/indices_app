import { cors } from 'hono/cors'
import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../app'

export function corsMiddleware(): MiddlewareHandler<AppEnv> {
	return async (c, next) => {
		const origins = (c.env.CORS_ORIGINS || 'http://localhost:3000')
			.split(',')
			.map((o) => o.trim())
		return cors({
			origin: origins,
			allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
			allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
			credentials: true,
		})(c, next)
	}
}
