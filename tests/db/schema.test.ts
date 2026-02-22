import { describe, it, expect } from 'vitest'
import { tenants } from '../../src/db/schema/tenants'
import { prospects } from '../../src/db/schema/prospects'
import { campaigns, channelResults } from '../../src/db/schema/campaigns'
import { segments, suppressionEntries } from '../../src/db/schema/segments'
import { auditLogs } from '../../src/db/schema/compliance'

describe('schema', () => {
  it('tenants table has required columns', () => {
    expect(tenants.id).toBeDefined()
    expect(tenants.name).toBeDefined()
    expect(tenants.slug).toBeDefined()
    expect(tenants.createdAt).toBeDefined()
  })

  it('prospects table has tenant_id foreign key', () => {
    expect(prospects.tenantId).toBeDefined()
    expect(prospects.email).toBeDefined()
  })

  it('campaigns table has tenant_id and status', () => {
    expect(campaigns.tenantId).toBeDefined()
    expect(campaigns.status).toBeDefined()
  })

  it('channelResults references campaign', () => {
    expect(channelResults.campaignId).toBeDefined()
    expect(channelResults.channel).toBeDefined()
  })

  it('segments table has rules jsonb', () => {
    expect(segments.rules).toBeDefined()
  })

  it('auditLogs table has action and actor', () => {
    expect(auditLogs.action).toBeDefined()
    expect(auditLogs.actor).toBeDefined()
  })
})
