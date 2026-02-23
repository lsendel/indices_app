import { describe, it, expect } from 'vitest'
import { configSchema } from '../src/config'

describe('config', () => {
  it('parses valid config with defaults', () => {
    const result = configSchema.safeParse({
      DATABASE_URL: 'postgresql://localhost/test',
      BETTER_AUTH_SECRET: 'test-secret',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.PORT).toBe(3001)
      expect(result.data.ENVIRONMENT).toBe('development')
    }
  })

  it('rejects missing DATABASE_URL', () => {
    const result = configSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('should accept new LLM provider API keys as optional', () => {
    const result = configSchema.safeParse({
      DATABASE_URL: 'postgresql://localhost/test',
      ANTHROPIC_API_KEY: 'sk-ant-test',
      GEMINI_API_KEY: 'ai-test',
      PERPLEXITY_API_KEY: 'pplx-test',
      GROK_API_KEY: 'xai-test',
      HUGGINGFACE_API_KEY: 'hf_test',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.ANTHROPIC_API_KEY).toBe('sk-ant-test')
      expect(result.data.GEMINI_API_KEY).toBe('ai-test')
      expect(result.data.PERPLEXITY_API_KEY).toBe('pplx-test')
      expect(result.data.GROK_API_KEY).toBe('xai-test')
      expect(result.data.HUGGINGFACE_API_KEY).toBe('hf_test')
    }
  })

  it('should work without any provider keys', () => {
    const result = configSchema.safeParse({
      DATABASE_URL: 'postgresql://localhost/test',
    })
    expect(result.success).toBe(true)
  })
})
