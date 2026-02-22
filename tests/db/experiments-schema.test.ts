import { describe, it, expect } from 'vitest'
import { experimentArms } from '../../src/db/schema/experiments'
import { personaProfiles } from '../../src/db/schema/personas'
import { brandKits } from '../../src/db/schema/brand-kits'

describe('experiments schema', () => {
  it('experimentArms has alpha, beta, trafficPct', () => {
    expect(experimentArms.id).toBeDefined()
    expect(experimentArms.experimentId).toBeDefined()
    expect(experimentArms.alpha).toBeDefined()
    expect(experimentArms.beta).toBeDefined()
    expect(experimentArms.trafficPct).toBeDefined()
  })
})

describe('personas schema', () => {
  it('personaProfiles has OCEAN scores', () => {
    expect(personaProfiles.id).toBeDefined()
    expect(personaProfiles.oceanScores).toBeDefined()
    expect(personaProfiles.demographics).toBeDefined()
  })
})

describe('brand kits schema', () => {
  it('brandKits has colors, typography, voice', () => {
    expect(brandKits.id).toBeDefined()
    expect(brandKits.colors).toBeDefined()
    expect(brandKits.typography).toBeDefined()
    expect(brandKits.voiceAttributes).toBeDefined()
  })
})
