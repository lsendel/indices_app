import { describe, it, expect } from 'vitest'
import { createApp } from '../../src/app'

describe('signals routes', () => {
  const app = createApp()

  it('POST /api/v1/signals/capture validates required fields', async () => {
    const res = await app.request('/api/v1/signals/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(422)
  })

  it('POST /api/v1/signals/capture validates strength range', async () => {
    const res = await app.request('/api/v1/signals/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acct-1',
        signalType: 'page_view',
        signalSource: 'website',
        strength: 150, // out of range
        signalData: {},
      }),
    })
    expect(res.status).toBe(422)
  })
})

describe('abm routes', () => {
  const app = createApp()

  it('POST /api/v1/accounts validates company name', async () => {
    const res = await app.request('/api/v1/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(422)
  })
})
