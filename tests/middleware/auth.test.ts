import { describe, it, expect, beforeAll } from 'vitest'
import { Hono } from 'hono'
import { authMiddleware } from '../../src/middleware/auth'
import { errorHandler } from '../../src/middleware/error-handler'

describe('auth middleware', () => {
  beforeAll(() => {
    process.env.ENVIRONMENT = 'production'
  })

  const app = new Hono()

  app.onError(errorHandler)
  app.use('/api/*', authMiddleware())
  app.get('/api/test', (c) => c.json({ userId: c.get('userId') }))
  app.get('/health', (c) => c.json({ status: 'ok' }))

  it('rejects unauthenticated API requests with 401', async () => {
    const res = await app.request('/api/test')
    expect(res.status).toBe(401)
  })

  it('allows health check without auth', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
  })
})
