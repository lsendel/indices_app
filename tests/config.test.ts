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
})
