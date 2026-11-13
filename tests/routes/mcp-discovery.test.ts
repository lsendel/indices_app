import { describe, expect, it } from 'vitest'
import { createApp } from '../../src/app'
import { getMcpToolNames } from '../../src/mcp/server'

describe('MCP connection discovery', () => {
  const app = createApp()
  const env = { ENVIRONMENT: 'production' } as any
  it('serves honest public metadata with canonical API URLs and live registry count', async () => {
    const res = await app.request('https://untrusted.example/.well-known/mcp.json', {}, env)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.mcpTransportAvailable).toBe(false)
    expect(body.restApi.toolsUrl).toBe('https://api.indices.app/api/v1/mcp/tools')
    expect(body.restApi.callUrl).toBe('https://api.indices.app/api/v1/mcp/call')
    expect(body.restApi.toolCount).toBe(getMcpToolNames().length)
    expect(JSON.stringify(body)).not.toContain('untrusted.example')
  })
  it('keeps catalogs and calls protected in production', async () => {
    const list = await app.request('/api/v1/mcp/tools', {}, env)
    expect(list.status).toBe(401)
    const call = await app.request('/api/v1/mcp/call', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }, env)
    expect(call.status).toBe(401)
  })
})
