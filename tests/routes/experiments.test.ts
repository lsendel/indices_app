import { describe, it, expect } from 'vitest'
import { createApp } from '../../src/app'

describe('experiments routes', () => {
  const app = createApp()

  it('POST /api/v1/experiments validates required fields', async () => {
    const res = await app.request('/api/v1/experiments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(422)
  })

  it('POST /api/v1/experiments validates name is not empty', async () => {
    const res = await app.request('/api/v1/experiments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', targetMetric: 'click_rate' }),
    })
    expect(res.status).toBe(422)
  })

  it('POST /api/v1/experiments/:id/reward validates armId and success', async () => {
    const res = await app.request('/api/v1/experiments/some-id/reward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(422)
  })
})
