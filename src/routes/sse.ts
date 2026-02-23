import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { AppEnv } from '../app'

type EventCallback = (tenantId: string, data: unknown) => void

const subscribers = new Map<string, Set<EventCallback>>()

export function emitEvent(event: string, data: unknown, id?: string): string {
	const lines: string[] = []
	if (id) lines.push(`id: ${id}`)
	lines.push(`event: ${event}`)
	lines.push(`data: ${JSON.stringify(data)}`)
	lines.push('')
	return lines.join('\n') + '\n'
}

export function broadcastToTenant(tenantId: string, event: string, data: unknown) {
	const tenantSubs = subscribers.get(tenantId)
	if (!tenantSubs) return
	for (const cb of tenantSubs) {
		cb(tenantId, { event, data })
	}
}

export function createSseRoutes() {
	const router = new Hono<AppEnv>()

	router.get('/stream', (c) => {
		const tenantId = c.get('tenantId')!

		return streamSSE(c, async (stream) => {
			const callback: EventCallback = (_tid, payload) => {
				const { event, data } = payload as { event: string; data: unknown }
				stream.writeSSE({ event, data: JSON.stringify(data) })
			}

			if (!subscribers.has(tenantId)) subscribers.set(tenantId, new Set())
			subscribers.get(tenantId)!.add(callback)

			stream.onAbort(() => {
				subscribers.get(tenantId)?.delete(callback)
			})

			while (true) {
				await stream.writeSSE({ event: 'heartbeat', data: new Date().toISOString() })
				await stream.sleep(30000)
			}
		})
	})

	return router
}
