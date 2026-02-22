import { describe, it, expect } from 'vitest'
import { createApp } from '../../src/app'

describe('personas routes', () => {
  const app = createApp()

  it('POST /api/v1/personas validates OCEAN scores', async () => {
    const res = await app.request('/api/v1/personas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(422)
  })

  it('POST /api/v1/personas rejects OCEAN scores out of range', async () => {
    const res = await app.request('/api/v1/personas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Persona',
        oceanScores: {
          openness: 1.5, // out of range
          conscientiousness: 0.5,
          extraversion: 0.5,
          agreeableness: 0.5,
          neuroticism: 0.5,
        },
      }),
    })
    expect(res.status).toBe(422)
  })
})

describe('brand-kits routes', () => {
  const app = createApp()

  it('POST /api/v1/brand-kits validates input', async () => {
    const res = await app.request('/api/v1/brand-kits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(422)
  })
})
