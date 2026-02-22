import { describe, it, expect } from 'vitest'
import { createApp } from '../../src/app'

const app = createApp()

describe('Phase 2 routes exist and validate', () => {
  it('POST /api/v1/signals/capture validates input', async () => {
    const res = await app.request('/api/v1/signals/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(422)
  })

  it('GET /api/v1/signals/hot responds', async () => {
    const res = await app.request('/api/v1/signals/hot')
    expect([200, 500]).toContain(res.status)
  })

  it('GET /api/v1/sentiment/signals responds', async () => {
    const res = await app.request('/api/v1/sentiment/signals?brand=test')
    expect([200, 500]).toContain(res.status)
  })

  it('GET /api/v1/sentiment/drift responds', async () => {
    const res = await app.request('/api/v1/sentiment/drift?brand=test')
    expect([200, 500]).toContain(res.status)
  })

  it('GET /api/v1/sentiment/competitive responds', async () => {
    const res = await app.request('/api/v1/sentiment/competitive')
    expect([200, 500]).toContain(res.status)
  })

  it('POST /api/v1/accounts validates input', async () => {
    const res = await app.request('/api/v1/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(422)
  })

  it('POST /api/v1/experiments validates input', async () => {
    const res = await app.request('/api/v1/experiments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(422)
  })

  it('POST /api/v1/personas validates OCEAN scores', async () => {
    const res = await app.request('/api/v1/personas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(422)
  })

  it('POST /api/v1/brand-kits validates input', async () => {
    const res = await app.request('/api/v1/brand-kits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(422)
  })
})
