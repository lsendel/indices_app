import { describe, it, expect } from 'vitest'
import { createApp } from '../src/app'

describe('app', () => {
  const app = createApp()

  it('returns health check', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  it('returns 404 for unknown routes', async () => {
    const res = await app.request('/nonexistent')
    expect(res.status).toBe(404)
  })

  it('includes X-Request-ID header', async () => {
    const res = await app.request('/health')
    expect(res.headers.get('x-request-id')).toBeTruthy()
  })
})
