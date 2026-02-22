import { describe, it, expect } from 'vitest'
import { signals } from '../../src/db/schema/signals'
import { accounts, deals } from '../../src/db/schema/accounts'

describe('signals schema', () => {
  it('signals has account, type, strength', () => {
    expect(signals.id).toBeDefined()
    expect(signals.tenantId).toBeDefined()
    expect(signals.accountId).toBeDefined()
    expect(signals.signalType).toBeDefined()
    expect(signals.strength).toBeDefined()
  })
})

describe('accounts schema', () => {
  it('accounts has company, score, tier', () => {
    expect(accounts.id).toBeDefined()
    expect(accounts.tenantId).toBeDefined()
    expect(accounts.company).toBeDefined()
    expect(accounts.score).toBeDefined()
    expect(accounts.tier).toBeDefined()
  })

  it('deals has value, stage, probability', () => {
    expect(deals.id).toBeDefined()
    expect(deals.accountId).toBeDefined()
    expect(deals.value).toBeDefined()
    expect(deals.stage).toBeDefined()
    expect(deals.probability).toBeDefined()
  })
})
