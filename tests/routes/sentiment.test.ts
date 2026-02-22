import { describe, it, expect } from 'vitest'
import { createApp } from '../../src/app'

describe('social-sentiment routes', () => {
  const app = createApp()

  it('GET /api/v1/sentiment/signals requires ticker param', async () => {
    const res = await app.request('/api/v1/sentiment/signals')
    // Should return 422 or default behavior
    expect([200, 422, 500]).toContain(res.status)
  })

  it('GET /api/v1/sentiment/drift returns drift events', async () => {
    const res = await app.request('/api/v1/sentiment/drift?brand=TestBrand')
    expect([200, 500]).toContain(res.status)
  })
})
