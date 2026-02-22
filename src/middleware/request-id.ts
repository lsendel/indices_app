import type { MiddlewareHandler } from 'hono'
import { randomUUID } from 'crypto'

export function requestId(): MiddlewareHandler {
	return async (c, next) => {
		const id = c.req.header('x-request-id') || randomUUID()
		c.set('requestId', id)
		c.header('X-Request-ID', id)
		await next()
	}
}
