import type { MiddlewareHandler } from 'hono'

export function requestId(): MiddlewareHandler {
	return async (c, next) => {
		const id = c.req.header('x-request-id') || crypto.randomUUID()
		c.set('requestId', id)
		c.header('X-Request-ID', id)
		await next()
	}
}
