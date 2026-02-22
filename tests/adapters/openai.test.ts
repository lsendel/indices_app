process.env.DATABASE_URL ??= 'postgresql://localhost/test'

import { describe, it, expect } from 'vitest'
import { createOpenAIAdapter } from '../../src/adapters/openai'

describe('OpenAI adapter', () => {
  it('creates adapter without throwing when no API key', () => {
    const adapter = createOpenAIAdapter()
    expect(adapter).toBeDefined()
    expect(adapter.analyzeSentiment).toBeDefined()
    expect(adapter.generateContent).toBeDefined()
  })
})
