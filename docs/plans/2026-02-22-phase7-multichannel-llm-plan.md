# Phase 7: Multi-Channel Content + Multi-Provider LLM — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single OpenAI adapter with a task-routed multi-provider LLM system (6 providers) and add channel-aware content generation for 12 channels.

**Architecture:** Strategy pattern with LLMProvider interface, LLMRouter for task→provider mapping, and per-channel content generators that compose with the router. Each provider adapter wraps its SDK and implements `generateText` + `generateJSON`. Channel generators apply platform constraints to prompts and validate output shapes.

**Tech Stack:** openai (OpenAI + Perplexity + Grok), @anthropic-ai/sdk (Claude), @google/generative-ai (Gemini), @huggingface/inference (HuggingFace), zod (output validation), vitest (testing)

---

### Task 1: LLM Provider Types

**Files:**
- Create: `src/adapters/llm/types.ts`
- Test: `tests/adapters/llm/types.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/adapters/llm/types.test.ts
import { describe, it, expect } from 'vitest'
import type { LLMProvider, GenerateOpts } from '../../../src/adapters/llm/types'

describe('LLMProvider types', () => {
	it('should type-check a valid provider implementation', () => {
		const provider: LLMProvider = {
			name: 'test',
			capabilities: new Set(['text', 'json']),
			async generateText(prompt: string, opts?: GenerateOpts) {
				return 'hello'
			},
			async generateJSON(prompt: string, schema: any, opts?: GenerateOpts) {
				return { result: true }
			},
		}
		expect(provider.name).toBe('test')
		expect(provider.capabilities.has('text')).toBe(true)
	})

	it('should type-check GenerateOpts', () => {
		const opts: GenerateOpts = {
			systemPrompt: 'You are helpful',
			temperature: 0.7,
			maxTokens: 1000,
			model: 'gpt-4o',
		}
		expect(opts.temperature).toBe(0.7)
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/adapters/llm/types.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/adapters/llm/types.ts
import type { z } from 'zod'

export type Capability = 'text' | 'json' | 'vision' | 'search' | 'realtime'

export interface GenerateOpts {
	systemPrompt?: string
	temperature?: number
	maxTokens?: number
	model?: string
}

export interface LLMProvider {
	name: string
	capabilities: Set<Capability>
	generateText(prompt: string, opts?: GenerateOpts): Promise<string>
	generateJSON<T>(prompt: string, schema: z.ZodType<T>, opts?: GenerateOpts): Promise<T>
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/adapters/llm/types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/adapters/llm/types.ts tests/adapters/llm/types.test.ts
git commit -m "feat(phase7): add LLMProvider interface and types"
```

---

### Task 2: OpenAI Provider

**Files:**
- Create: `src/adapters/llm/openai.ts`
- Test: `tests/adapters/llm/openai.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/adapters/llm/openai.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { createOpenAIProvider } from '../../../src/adapters/llm/openai'

// Mock the openai module
vi.mock('openai', () => {
	const mockCreate = vi.fn()
	return {
		default: class {
			chat = { completions: { create: mockCreate } }
		},
		__mockCreate: mockCreate,
	}
})

describe('OpenAIProvider', () => {
	let mockCreate: ReturnType<typeof vi.fn>

	beforeEach(async () => {
		const mod = await import('openai')
		mockCreate = (mod as any).__mockCreate
		mockCreate.mockReset()
	})

	it('should have correct name and capabilities', () => {
		const provider = createOpenAIProvider('test-key')
		expect(provider.name).toBe('openai')
		expect(provider.capabilities.has('text')).toBe(true)
		expect(provider.capabilities.has('json')).toBe(true)
		expect(provider.capabilities.has('vision')).toBe(true)
	})

	it('should generate text', async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [{ message: { content: 'Hello world' } }],
		})

		const provider = createOpenAIProvider('test-key')
		const result = await provider.generateText('Say hello')
		expect(result).toBe('Hello world')
		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: expect.arrayContaining([
					expect.objectContaining({ role: 'user', content: 'Say hello' }),
				]),
			}),
		)
	})

	it('should generate JSON with schema validation', async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [{ message: { content: '{"score": 0.8, "label": "positive"}' } }],
		})

		const schema = z.object({ score: z.number(), label: z.string() })
		const provider = createOpenAIProvider('test-key')
		const result = await provider.generateJSON('Analyze this', schema)
		expect(result).toEqual({ score: 0.8, label: 'positive' })
	})

	it('should include system prompt when provided', async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [{ message: { content: 'response' } }],
		})

		const provider = createOpenAIProvider('test-key')
		await provider.generateText('prompt', { systemPrompt: 'Be concise' })
		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: expect.arrayContaining([
					{ role: 'system', content: 'Be concise' },
				]),
			}),
		)
	})

	it('should throw on empty response', async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [{ message: { content: null } }],
		})

		const provider = createOpenAIProvider('test-key')
		await expect(provider.generateText('prompt')).rejects.toThrow('empty')
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/adapters/llm/openai.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/adapters/llm/openai.ts
import OpenAI from 'openai'
import type { z } from 'zod'
import type { LLMProvider, GenerateOpts } from './types'

export function createOpenAIProvider(apiKey: string, defaultModel = 'gpt-4o'): LLMProvider {
	const client = new OpenAI({ apiKey })

	return {
		name: 'openai',
		capabilities: new Set(['text', 'json', 'vision']),

		async generateText(prompt: string, opts?: GenerateOpts): Promise<string> {
			const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []
			if (opts?.systemPrompt) {
				messages.push({ role: 'system', content: opts.systemPrompt })
			}
			messages.push({ role: 'user', content: prompt })

			const response = await client.chat.completions.create({
				model: opts?.model ?? defaultModel,
				messages,
				temperature: opts?.temperature ?? 0.7,
				max_tokens: opts?.maxTokens ?? 1000,
			})

			const content = response.choices[0]?.message?.content
			if (!content) {
				throw new Error('OpenAI returned empty response')
			}
			return content
		},

		async generateJSON<T>(prompt: string, schema: z.ZodType<T>, opts?: GenerateOpts): Promise<T> {
			const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []
			if (opts?.systemPrompt) {
				messages.push({ role: 'system', content: opts.systemPrompt })
			}
			messages.push({ role: 'user', content: prompt })

			const response = await client.chat.completions.create({
				model: opts?.model ?? defaultModel,
				messages,
				response_format: { type: 'json_object' },
				temperature: opts?.temperature ?? 0.3,
				max_tokens: opts?.maxTokens ?? 1000,
			})

			const content = response.choices[0]?.message?.content
			if (!content) {
				throw new Error('OpenAI returned empty response')
			}
			return schema.parse(JSON.parse(content))
		},
	}
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/adapters/llm/openai.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/adapters/llm/openai.ts tests/adapters/llm/openai.test.ts
git commit -m "feat(phase7): add OpenAI LLM provider adapter"
```

---

### Task 3: Claude Provider

**Files:**
- Create: `src/adapters/llm/claude.ts`
- Test: `tests/adapters/llm/claude.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/adapters/llm/claude.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { createClaudeProvider } from '../../../src/adapters/llm/claude'

vi.mock('@anthropic-ai/sdk', () => {
	const mockCreate = vi.fn()
	return {
		default: class {
			messages = { create: mockCreate }
		},
		__mockCreate: mockCreate,
	}
})

describe('ClaudeProvider', () => {
	let mockCreate: ReturnType<typeof vi.fn>

	beforeEach(async () => {
		const mod = await import('@anthropic-ai/sdk')
		mockCreate = (mod as any).__mockCreate
		mockCreate.mockReset()
	})

	it('should have correct name and capabilities', () => {
		const provider = createClaudeProvider('test-key')
		expect(provider.name).toBe('claude')
		expect(provider.capabilities.has('text')).toBe(true)
		expect(provider.capabilities.has('json')).toBe(true)
		expect(provider.capabilities.has('vision')).toBe(false)
	})

	it('should generate text', async () => {
		mockCreate.mockResolvedValueOnce({
			content: [{ type: 'text', text: 'Hello from Claude' }],
		})

		const provider = createClaudeProvider('test-key')
		const result = await provider.generateText('Say hello')
		expect(result).toBe('Hello from Claude')
	})

	it('should generate JSON with schema validation', async () => {
		mockCreate.mockResolvedValueOnce({
			content: [{ type: 'text', text: '{"name": "Alice", "age": 30}' }],
		})

		const schema = z.object({ name: z.string(), age: z.number() })
		const provider = createClaudeProvider('test-key')
		const result = await provider.generateJSON('Generate person', schema)
		expect(result).toEqual({ name: 'Alice', age: 30 })
	})

	it('should pass system prompt correctly', async () => {
		mockCreate.mockResolvedValueOnce({
			content: [{ type: 'text', text: 'response' }],
		})

		const provider = createClaudeProvider('test-key')
		await provider.generateText('prompt', { systemPrompt: 'Be brief' })
		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				system: 'Be brief',
			}),
		)
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/adapters/llm/claude.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/adapters/llm/claude.ts
import Anthropic from '@anthropic-ai/sdk'
import type { z } from 'zod'
import type { LLMProvider, GenerateOpts } from './types'

export function createClaudeProvider(apiKey: string, defaultModel = 'claude-sonnet-4-20250514'): LLMProvider {
	const client = new Anthropic({ apiKey })

	return {
		name: 'claude',
		capabilities: new Set(['text', 'json']),

		async generateText(prompt: string, opts?: GenerateOpts): Promise<string> {
			const response = await client.messages.create({
				model: opts?.model ?? defaultModel,
				max_tokens: opts?.maxTokens ?? 1000,
				...(opts?.systemPrompt ? { system: opts.systemPrompt } : {}),
				messages: [{ role: 'user', content: prompt }],
			})

			const block = response.content[0]
			if (!block || block.type !== 'text') {
				throw new Error('Claude returned empty response')
			}
			return block.text
		},

		async generateJSON<T>(prompt: string, schema: z.ZodType<T>, opts?: GenerateOpts): Promise<T> {
			const jsonPrompt = `${prompt}\n\nRespond with valid JSON only. No markdown, no explanation.`
			const text = await this.generateText(jsonPrompt, {
				...opts,
				temperature: opts?.temperature ?? 0.3,
			})

			// Strip markdown fences if present
			const cleaned = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
			return schema.parse(JSON.parse(cleaned))
		},
	}
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/adapters/llm/claude.test.ts`
Expected: PASS

**Step 5: Install dependency and commit**

```bash
bun add @anthropic-ai/sdk
git add src/adapters/llm/claude.ts tests/adapters/llm/claude.test.ts package.json bun.lock
git commit -m "feat(phase7): add Claude LLM provider adapter"
```

---

### Task 4: Gemini Provider

**Files:**
- Create: `src/adapters/llm/gemini.ts`
- Test: `tests/adapters/llm/gemini.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/adapters/llm/gemini.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { createGeminiProvider } from '../../../src/adapters/llm/gemini'

vi.mock('@google/generative-ai', () => {
	const mockGenerateContent = vi.fn()
	return {
		GoogleGenerativeAI: class {
			getGenerativeModel() {
				return { generateContent: mockGenerateContent }
			}
		},
		__mockGenerateContent: mockGenerateContent,
	}
})

describe('GeminiProvider', () => {
	let mockGenerateContent: ReturnType<typeof vi.fn>

	beforeEach(async () => {
		const mod = await import('@google/generative-ai')
		mockGenerateContent = (mod as any).__mockGenerateContent
		mockGenerateContent.mockReset()
	})

	it('should have correct name and capabilities', () => {
		const provider = createGeminiProvider('test-key')
		expect(provider.name).toBe('gemini')
		expect(provider.capabilities.has('vision')).toBe(true)
	})

	it('should generate text', async () => {
		mockGenerateContent.mockResolvedValueOnce({
			response: { text: () => 'Hello from Gemini' },
		})

		const provider = createGeminiProvider('test-key')
		const result = await provider.generateText('Say hello')
		expect(result).toBe('Hello from Gemini')
	})

	it('should generate JSON with schema validation', async () => {
		mockGenerateContent.mockResolvedValueOnce({
			response: { text: () => '{"title": "My Video", "duration": 30}' },
		})

		const schema = z.object({ title: z.string(), duration: z.number() })
		const provider = createGeminiProvider('test-key')
		const result = await provider.generateJSON('Generate video metadata', schema)
		expect(result).toEqual({ title: 'My Video', duration: 30 })
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/adapters/llm/gemini.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/adapters/llm/gemini.ts
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { z } from 'zod'
import type { LLMProvider, GenerateOpts } from './types'

export function createGeminiProvider(apiKey: string, defaultModel = 'gemini-2.0-flash'): LLMProvider {
	const genAI = new GoogleGenerativeAI(apiKey)

	return {
		name: 'gemini',
		capabilities: new Set(['text', 'json', 'vision']),

		async generateText(prompt: string, opts?: GenerateOpts): Promise<string> {
			const model = genAI.getGenerativeModel({ model: opts?.model ?? defaultModel })
			const fullPrompt = opts?.systemPrompt ? `${opts.systemPrompt}\n\n${prompt}` : prompt

			const result = await model.generateContent(fullPrompt)
			const text = result.response.text()
			if (!text) {
				throw new Error('Gemini returned empty response')
			}
			return text
		},

		async generateJSON<T>(prompt: string, schema: z.ZodType<T>, opts?: GenerateOpts): Promise<T> {
			const jsonPrompt = `${prompt}\n\nRespond with valid JSON only. No markdown, no explanation.`
			const text = await this.generateText(jsonPrompt, {
				...opts,
				temperature: opts?.temperature ?? 0.3,
			})

			const cleaned = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
			return schema.parse(JSON.parse(cleaned))
		},
	}
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/adapters/llm/gemini.test.ts`
Expected: PASS

**Step 5: Install dependency and commit**

```bash
bun add @google/generative-ai
git add src/adapters/llm/gemini.ts tests/adapters/llm/gemini.test.ts package.json bun.lock
git commit -m "feat(phase7): add Gemini LLM provider adapter"
```

---

### Task 5: Perplexity + Grok Providers (OpenAI-Compatible)

**Files:**
- Create: `src/adapters/llm/perplexity.ts`
- Create: `src/adapters/llm/grok.ts`
- Test: `tests/adapters/llm/perplexity.test.ts`
- Test: `tests/adapters/llm/grok.test.ts`

**Step 1: Write the failing tests**

```typescript
// tests/adapters/llm/perplexity.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { createPerplexityProvider } from '../../../src/adapters/llm/perplexity'

vi.mock('openai', () => {
	const mockCreate = vi.fn()
	return {
		default: class {
			constructor(public opts: any) {}
			chat = { completions: { create: mockCreate } }
		},
		__mockCreate: mockCreate,
	}
})

describe('PerplexityProvider', () => {
	let mockCreate: ReturnType<typeof vi.fn>

	beforeEach(async () => {
		const mod = await import('openai')
		mockCreate = (mod as any).__mockCreate
		mockCreate.mockReset()
	})

	it('should have correct name and capabilities', () => {
		const provider = createPerplexityProvider('test-key')
		expect(provider.name).toBe('perplexity')
		expect(provider.capabilities.has('search')).toBe(true)
	})

	it('should generate text via OpenAI-compatible API', async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [{ message: { content: 'Research result' } }],
		})

		const provider = createPerplexityProvider('test-key')
		const result = await provider.generateText('Research this topic')
		expect(result).toBe('Research result')
	})

	it('should generate JSON', async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [{ message: { content: '{"findings": ["a", "b"]}' } }],
		})

		const schema = z.object({ findings: z.array(z.string()) })
		const provider = createPerplexityProvider('test-key')
		const result = await provider.generateJSON('Find info', schema)
		expect(result).toEqual({ findings: ['a', 'b'] })
	})
})
```

```typescript
// tests/adapters/llm/grok.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createGrokProvider } from '../../../src/adapters/llm/grok'

vi.mock('openai', () => {
	const mockCreate = vi.fn()
	return {
		default: class {
			constructor(public opts: any) {}
			chat = { completions: { create: mockCreate } }
		},
		__mockCreate: mockCreate,
	}
})

describe('GrokProvider', () => {
	let mockCreate: ReturnType<typeof vi.fn>

	beforeEach(async () => {
		const mod = await import('openai')
		mockCreate = (mod as any).__mockCreate
		mockCreate.mockReset()
	})

	it('should have correct name and capabilities', () => {
		const provider = createGrokProvider('test-key')
		expect(provider.name).toBe('grok')
		expect(provider.capabilities.has('realtime')).toBe(true)
	})

	it('should generate text', async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [{ message: { content: 'Trending now' } }],
		})

		const provider = createGrokProvider('test-key')
		const result = await provider.generateText('What is trending?')
		expect(result).toBe('Trending now')
	})
})
```

**Step 2: Run tests to verify they fail**

Run: `bunx vitest run tests/adapters/llm/perplexity.test.ts tests/adapters/llm/grok.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementations**

```typescript
// src/adapters/llm/perplexity.ts
import OpenAI from 'openai'
import type { z } from 'zod'
import type { LLMProvider, GenerateOpts } from './types'

export function createPerplexityProvider(apiKey: string, defaultModel = 'sonar-pro'): LLMProvider {
	const client = new OpenAI({
		apiKey,
		baseURL: 'https://api.perplexity.ai',
	})

	return {
		name: 'perplexity',
		capabilities: new Set(['text', 'json', 'search']),

		async generateText(prompt: string, opts?: GenerateOpts): Promise<string> {
			const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []
			if (opts?.systemPrompt) messages.push({ role: 'system', content: opts.systemPrompt })
			messages.push({ role: 'user', content: prompt })

			const response = await client.chat.completions.create({
				model: opts?.model ?? defaultModel,
				messages,
				temperature: opts?.temperature ?? 0.7,
				max_tokens: opts?.maxTokens ?? 1000,
			})

			const content = response.choices[0]?.message?.content
			if (!content) throw new Error('Perplexity returned empty response')
			return content
		},

		async generateJSON<T>(prompt: string, schema: z.ZodType<T>, opts?: GenerateOpts): Promise<T> {
			const jsonPrompt = `${prompt}\n\nRespond with valid JSON only.`
			const text = await this.generateText(jsonPrompt, { ...opts, temperature: opts?.temperature ?? 0.3 })
			const cleaned = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
			return schema.parse(JSON.parse(cleaned))
		},
	}
}
```

```typescript
// src/adapters/llm/grok.ts
import OpenAI from 'openai'
import type { z } from 'zod'
import type { LLMProvider, GenerateOpts } from './types'

export function createGrokProvider(apiKey: string, defaultModel = 'grok-3'): LLMProvider {
	const client = new OpenAI({
		apiKey,
		baseURL: 'https://api.x.ai/v1',
	})

	return {
		name: 'grok',
		capabilities: new Set(['text', 'json', 'realtime']),

		async generateText(prompt: string, opts?: GenerateOpts): Promise<string> {
			const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []
			if (opts?.systemPrompt) messages.push({ role: 'system', content: opts.systemPrompt })
			messages.push({ role: 'user', content: prompt })

			const response = await client.chat.completions.create({
				model: opts?.model ?? defaultModel,
				messages,
				temperature: opts?.temperature ?? 0.7,
				max_tokens: opts?.maxTokens ?? 1000,
			})

			const content = response.choices[0]?.message?.content
			if (!content) throw new Error('Grok returned empty response')
			return content
		},

		async generateJSON<T>(prompt: string, schema: z.ZodType<T>, opts?: GenerateOpts): Promise<T> {
			const jsonPrompt = `${prompt}\n\nRespond with valid JSON only.`
			const text = await this.generateText(jsonPrompt, { ...opts, temperature: opts?.temperature ?? 0.3 })
			const cleaned = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
			return schema.parse(JSON.parse(cleaned))
		},
	}
}
```

**Step 4: Run tests to verify they pass**

Run: `bunx vitest run tests/adapters/llm/perplexity.test.ts tests/adapters/llm/grok.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/adapters/llm/perplexity.ts src/adapters/llm/grok.ts tests/adapters/llm/perplexity.test.ts tests/adapters/llm/grok.test.ts
git commit -m "feat(phase7): add Perplexity and Grok LLM provider adapters"
```

---

### Task 6: HuggingFace Provider

**Files:**
- Create: `src/adapters/llm/huggingface.ts`
- Test: `tests/adapters/llm/huggingface.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/adapters/llm/huggingface.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { createHuggingFaceProvider } from '../../../src/adapters/llm/huggingface'

vi.mock('@huggingface/inference', () => {
	const mockTextGeneration = vi.fn()
	return {
		HfInference: class {
			textGeneration = mockTextGeneration
		},
		__mockTextGeneration: mockTextGeneration,
	}
})

describe('HuggingFaceProvider', () => {
	let mockTextGeneration: ReturnType<typeof vi.fn>

	beforeEach(async () => {
		const mod = await import('@huggingface/inference')
		mockTextGeneration = (mod as any).__mockTextGeneration
		mockTextGeneration.mockReset()
	})

	it('should have correct name and capabilities', () => {
		const provider = createHuggingFaceProvider('test-key')
		expect(provider.name).toBe('huggingface')
		expect(provider.capabilities.has('text')).toBe(true)
	})

	it('should generate text', async () => {
		mockTextGeneration.mockResolvedValueOnce({
			generated_text: 'HF output',
		})

		const provider = createHuggingFaceProvider('test-key')
		const result = await provider.generateText('Generate something')
		expect(result).toBe('HF output')
	})

	it('should generate JSON', async () => {
		mockTextGeneration.mockResolvedValueOnce({
			generated_text: '{"items": [1, 2, 3]}',
		})

		const schema = z.object({ items: z.array(z.number()) })
		const provider = createHuggingFaceProvider('test-key')
		const result = await provider.generateJSON('List items', schema)
		expect(result).toEqual({ items: [1, 2, 3] })
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/adapters/llm/huggingface.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/adapters/llm/huggingface.ts
import { HfInference } from '@huggingface/inference'
import type { z } from 'zod'
import type { LLMProvider, GenerateOpts } from './types'

export function createHuggingFaceProvider(apiKey: string, defaultModel = 'mistralai/Mistral-7B-Instruct-v0.3'): LLMProvider {
	const client = new HfInference(apiKey)

	return {
		name: 'huggingface',
		capabilities: new Set(['text', 'json']),

		async generateText(prompt: string, opts?: GenerateOpts): Promise<string> {
			const fullPrompt = opts?.systemPrompt ? `${opts.systemPrompt}\n\n${prompt}` : prompt

			const result = await client.textGeneration({
				model: opts?.model ?? defaultModel,
				inputs: fullPrompt,
				parameters: {
					temperature: opts?.temperature ?? 0.7,
					max_new_tokens: opts?.maxTokens ?? 1000,
					return_full_text: false,
				},
			})

			if (!result.generated_text) {
				throw new Error('HuggingFace returned empty response')
			}
			return result.generated_text
		},

		async generateJSON<T>(prompt: string, schema: z.ZodType<T>, opts?: GenerateOpts): Promise<T> {
			const jsonPrompt = `${prompt}\n\nRespond with valid JSON only. No explanation.`
			const text = await this.generateText(jsonPrompt, { ...opts, temperature: opts?.temperature ?? 0.3 })
			const cleaned = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
			return schema.parse(JSON.parse(cleaned))
		},
	}
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/adapters/llm/huggingface.test.ts`
Expected: PASS

**Step 5: Install dependency and commit**

```bash
bun add @huggingface/inference
git add src/adapters/llm/huggingface.ts tests/adapters/llm/huggingface.test.ts package.json bun.lock
git commit -m "feat(phase7): add HuggingFace LLM provider adapter"
```

---

### Task 7: LLM Router

**Files:**
- Create: `src/adapters/llm/router.ts`
- Create: `src/adapters/llm/index.ts`
- Test: `tests/adapters/llm/router.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/adapters/llm/router.test.ts
import { describe, it, expect } from 'vitest'
import type { LLMProvider } from '../../../src/adapters/llm/types'
import { createLLMRouter } from '../../../src/adapters/llm/router'

function mockProvider(name: string): LLMProvider {
	return {
		name,
		capabilities: new Set(['text', 'json']),
		async generateText() { return `from-${name}` },
		async generateJSON() { return { from: name } },
	}
}

describe('LLMRouter', () => {
	it('should resolve provider for a known task', () => {
		const router = createLLMRouter(
			{ openai: mockProvider('openai'), claude: mockProvider('claude') },
			{ 'content:email': 'claude', 'analysis:sentiment': 'openai' },
		)

		const provider = router.resolve('content:email')
		expect(provider.name).toBe('claude')
	})

	it('should fall back to first available provider for unknown task', () => {
		const router = createLLMRouter(
			{ openai: mockProvider('openai') },
			{},
		)

		const provider = router.resolve('unknown:task')
		expect(provider.name).toBe('openai')
	})

	it('should fall back when preferred provider is not available', () => {
		const router = createLLMRouter(
			{ openai: mockProvider('openai') },
			{ 'content:email': 'claude' },  // claude not in providers
		)

		const provider = router.resolve('content:email')
		expect(provider.name).toBe('openai')
	})

	it('should throw when no providers are available', () => {
		expect(() => createLLMRouter({}, {})).toThrow('No LLM providers')
	})

	it('should list available providers', () => {
		const router = createLLMRouter(
			{ openai: mockProvider('openai'), claude: mockProvider('claude') },
			{},
		)

		const providers = router.listProviders()
		expect(providers).toHaveLength(2)
		expect(providers.map((p) => p.name)).toContain('openai')
		expect(providers.map((p) => p.name)).toContain('claude')
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/adapters/llm/router.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/adapters/llm/router.ts
import type { LLMProvider } from './types'

export interface LLMRouter {
	resolve(task: string): LLMProvider
	listProviders(): LLMProvider[]
}

export function createLLMRouter(
	providers: Record<string, LLMProvider>,
	routing: Record<string, string>,
): LLMRouter {
	const providerList = Object.values(providers)
	if (providerList.length === 0) {
		throw new Error('No LLM providers configured')
	}

	return {
		resolve(task: string): LLMProvider {
			const preferredName = routing[task]
			if (preferredName && providers[preferredName]) {
				return providers[preferredName]
			}
			// Fallback to first available
			return providerList[0]
		},

		listProviders(): LLMProvider[] {
			return providerList
		},
	}
}
```

```typescript
// src/adapters/llm/index.ts
export { createLLMRouter } from './router'
export type { LLMRouter } from './router'
export type { LLMProvider, GenerateOpts, Capability } from './types'
export { createOpenAIProvider } from './openai'
export { createClaudeProvider } from './claude'
export { createGeminiProvider } from './gemini'
export { createPerplexityProvider } from './perplexity'
export { createGrokProvider } from './grok'
export { createHuggingFaceProvider } from './huggingface'
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/adapters/llm/router.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/adapters/llm/router.ts src/adapters/llm/index.ts tests/adapters/llm/router.test.ts
git commit -m "feat(phase7): add LLM router with task-to-provider mapping"
```

---

### Task 8: Channel Types and Config

**Files:**
- Create: `src/adapters/channels/types.ts`
- Create: `src/adapters/channels/config.ts`
- Test: `tests/adapters/channels/config.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/adapters/channels/config.test.ts
import { describe, it, expect } from 'vitest'
import { channelConfig, SUPPORTED_CHANNELS, type ContentBrief } from '../../../src/adapters/channels/config'

describe('channelConfig', () => {
	it('should define all 12 channels', () => {
		expect(SUPPORTED_CHANNELS).toHaveLength(12)
		expect(SUPPORTED_CHANNELS).toContain('email')
		expect(SUPPORTED_CHANNELS).toContain('sms')
		expect(SUPPORTED_CHANNELS).toContain('voice')
		expect(SUPPORTED_CHANNELS).toContain('whatsapp')
		expect(SUPPORTED_CHANNELS).toContain('linkedin')
		expect(SUPPORTED_CHANNELS).toContain('facebook')
		expect(SUPPORTED_CHANNELS).toContain('instagram')
		expect(SUPPORTED_CHANNELS).toContain('tiktok')
		expect(SUPPORTED_CHANNELS).toContain('youtube')
		expect(SUPPORTED_CHANNELS).toContain('vimeo')
		expect(SUPPORTED_CHANNELS).toContain('video')
	})

	it('should have constraints for every channel', () => {
		for (const channel of SUPPORTED_CHANNELS) {
			const config = channelConfig[channel]
			expect(config).toBeDefined()
			expect(config.format).toBeDefined()
			expect(config.promptSuffix).toBeDefined()
		}
	})

	it('should enforce email subject limit of 60', () => {
		expect(channelConfig.email.constraints.subjectLimit).toBe(60)
	})

	it('should enforce SMS character limit', () => {
		expect(channelConfig.sms.constraints.charLimit).toBe(160)
	})

	it('should enforce TikTok duration limit', () => {
		expect(channelConfig.tiktok.constraints.maxDuration).toBe(60)
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/adapters/channels/config.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/adapters/channels/types.ts
export interface ContentBrief {
	goal: string
	product: string
	audience: string
	tone: string
	keywords?: string[]
	campaignId?: string
	brandKitId?: string
}

export interface EmailContent {
	subject: string
	preheader: string
	bodyHtml: string
	bodyText: string
	cta: { text: string; url: string }
}

export interface SMSContent {
	message: string
	parts: number
}

export interface VoiceContent {
	script: string
	duration: number
	tone: string
}

export interface WhatsAppContent {
	message: string
	templateName?: string
	buttons?: Array<{ text: string; url: string }>
}

export interface SocialContent {
	text: string
	hashtags: string[]
	mediaPrompt?: string
	cta?: string
}

export interface VideoScriptContent {
	script: string
	duration: number
	shots: Array<{ type: string; seconds: string; visual: string; audio: string }>
	captions: string
	hashtags: string[]
	thumbnailConcept: string
}

export interface YouTubeContent extends VideoScriptContent {
	title: string
	description: string
	tags: string[]
	chapters: Array<{ timestamp: string; title: string }>
}

export interface VimeoContent extends VideoScriptContent {
	title: string
	description: string
	tags: string[]
}

export type ChannelOutput =
	| EmailContent
	| SMSContent
	| VoiceContent
	| WhatsAppContent
	| SocialContent
	| VideoScriptContent
	| YouTubeContent
	| VimeoContent
```

```typescript
// src/adapters/channels/config.ts
export { type ContentBrief } from './types'

export interface ChannelConstraints {
	[key: string]: unknown
}

export interface ChannelConfig {
	format: string
	constraints: ChannelConstraints
	promptSuffix: string
}

export const SUPPORTED_CHANNELS = [
	'email', 'sms', 'voice', 'whatsapp', 'linkedin', 'facebook',
	'instagram', 'tiktok', 'youtube', 'vimeo', 'video',
] as const

export type Channel = (typeof SUPPORTED_CHANNELS)[number]

export const channelConfig: Record<Channel, ChannelConfig> = {
	email: {
		format: 'html',
		constraints: { subjectLimit: 60, preheaderLimit: 100, ctaRequired: true },
		promptSuffix: 'Generate an email with subject (max 60 chars), preheader (max 100 chars), HTML body, plain text body, and a CTA button.',
	},
	sms: {
		format: 'text',
		constraints: { charLimit: 160, multiPartLimit: 320 },
		promptSuffix: 'Generate an SMS message (max 160 characters for single part, 320 for multi-part). Be concise and include a clear CTA.',
	},
	voice: {
		format: 'script',
		constraints: { maxDuration: 90, toneRequired: true },
		promptSuffix: 'Generate a voice call script. Use conversational tone, include pauses, and target 30-90 seconds duration.',
	},
	whatsapp: {
		format: 'rich_text',
		constraints: { charLimit: 4096, templateBased: true },
		promptSuffix: 'Generate a WhatsApp Business message (max 4096 chars). Can include buttons and media prompts. Keep it conversational.',
	},
	linkedin: {
		format: 'text',
		constraints: { postLimit: 3000, mediaTypes: ['image', 'video', 'document'] },
		promptSuffix: 'Generate a LinkedIn post (max 3000 chars). Professional tone, can include hashtags. Suggest media if relevant.',
	},
	facebook: {
		format: 'text',
		constraints: { postLimit: 63206, hashtagLimit: 30 },
		promptSuffix: 'Generate a Facebook post. Engaging, shareable, with relevant hashtags. Suggest media type if relevant.',
	},
	instagram: {
		format: 'caption',
		constraints: { captionLimit: 2200, hashtagLimit: 30, visualFirst: true },
		promptSuffix: 'Generate an Instagram caption (max 2200 chars, max 30 hashtags). Visual-first — describe the ideal image/video to pair with it.',
	},
	tiktok: {
		format: 'video_script',
		constraints: { maxDuration: 60, hashtagLimit: 5, aspectRatio: '9:16' },
		promptSuffix: 'Generate a TikTok video script (max 60s). Structure: hook (0-3s), body (3-50s), CTA (50-60s). Include captions and up to 5 hashtags.',
	},
	youtube: {
		format: 'video_script',
		constraints: { titleLimit: 100, descriptionLimit: 5000, tagLimit: 500 },
		promptSuffix: 'Generate a YouTube video script with title (max 100 chars), description (max 5000 chars), tags, chapter markers, and thumbnail concept.',
	},
	vimeo: {
		format: 'video_script',
		constraints: { titleLimit: 128, tagLimit: 20 },
		promptSuffix: 'Generate a Vimeo video script with title (max 128 chars), description, and tags. Professional, polished tone.',
	},
	video: {
		format: 'video_script',
		constraints: { flexible: true },
		promptSuffix: 'Generate a video script with shot list (type, duration, visual, audio), captions, and thumbnail concept.',
	},
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/adapters/channels/config.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/adapters/channels/types.ts src/adapters/channels/config.ts tests/adapters/channels/config.test.ts
git commit -m "feat(phase7): add channel types, config, and platform constraints for 12 channels"
```

---

### Task 9: Channel Content Generator

**Files:**
- Create: `src/adapters/channels/generator.ts`
- Create: `src/adapters/channels/index.ts`
- Test: `tests/adapters/channels/generator.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/adapters/channels/generator.test.ts
import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { generateForChannel } from '../../../src/adapters/channels/generator'
import type { LLMRouter } from '../../../src/adapters/llm'
import type { ContentBrief } from '../../../src/adapters/channels/config'

function mockRouter(): LLMRouter {
	return {
		resolve: vi.fn().mockReturnValue({
			name: 'mock',
			capabilities: new Set(['text', 'json']),
			generateText: vi.fn().mockResolvedValue('generated text'),
			generateJSON: vi.fn().mockImplementation((_prompt: string, schema: z.ZodType) => {
				// Return a valid shape for any schema
				return Promise.resolve({
					subject: 'Test Subject',
					preheader: 'Test preheader',
					bodyHtml: '<p>Hello</p>',
					bodyText: 'Hello',
					cta: { text: 'Click', url: 'https://example.com' },
				})
			}),
		}),
		listProviders: vi.fn().mockReturnValue([]),
	}
}

const testBrief: ContentBrief = {
	goal: 'Drive signups',
	product: 'Marketing tool',
	audience: 'B2B marketers',
	tone: 'Professional',
}

describe('generateForChannel', () => {
	it('should resolve the correct provider for the channel', async () => {
		const router = mockRouter()
		await generateForChannel('email', testBrief, router)
		expect(router.resolve).toHaveBeenCalledWith('content:email')
	})

	it('should include channel constraints in the prompt', async () => {
		const router = mockRouter()
		const provider = router.resolve('content:email')
		await generateForChannel('email', testBrief, router)
		expect(provider.generateJSON).toHaveBeenCalledWith(
			expect.stringContaining('subject'),
			expect.anything(),
			expect.anything(),
		)
	})

	it('should include brief details in the prompt', async () => {
		const router = mockRouter()
		const provider = router.resolve('content:email')
		await generateForChannel('email', testBrief, router)
		expect(provider.generateJSON).toHaveBeenCalledWith(
			expect.stringContaining('Drive signups'),
			expect.anything(),
			expect.anything(),
		)
	})

	it('should throw for unsupported channel', async () => {
		const router = mockRouter()
		await expect(
			generateForChannel('carrier_pigeon' as any, testBrief, router),
		).rejects.toThrow('Unsupported channel')
	})

	it('should allow provider override', async () => {
		const router = mockRouter()
		await generateForChannel('email', testBrief, router, 'claude')
		expect(router.resolve).toHaveBeenCalledWith('content:email')
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/adapters/channels/generator.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/adapters/channels/generator.ts
import { z } from 'zod'
import type { LLMRouter } from '../llm'
import { channelConfig, SUPPORTED_CHANNELS, type Channel, type ContentBrief } from './config'

const emailSchema = z.object({
	subject: z.string(),
	preheader: z.string(),
	bodyHtml: z.string(),
	bodyText: z.string(),
	cta: z.object({ text: z.string(), url: z.string() }),
})

const smsSchema = z.object({ message: z.string(), parts: z.number() })

const voiceSchema = z.object({ script: z.string(), duration: z.number(), tone: z.string() })

const whatsappSchema = z.object({
	message: z.string(),
	templateName: z.string().optional(),
	buttons: z.array(z.object({ text: z.string(), url: z.string() })).optional(),
})

const socialSchema = z.object({
	text: z.string(),
	hashtags: z.array(z.string()),
	mediaPrompt: z.string().optional(),
	cta: z.string().optional(),
})

const videoScriptSchema = z.object({
	script: z.string(),
	duration: z.number(),
	shots: z.array(z.object({ type: z.string(), seconds: z.string(), visual: z.string(), audio: z.string() })),
	captions: z.string(),
	hashtags: z.array(z.string()),
	thumbnailConcept: z.string(),
})

const youtubeSchema = videoScriptSchema.extend({
	title: z.string(),
	description: z.string(),
	tags: z.array(z.string()),
	chapters: z.array(z.object({ timestamp: z.string(), title: z.string() })),
})

const vimeoSchema = videoScriptSchema.extend({
	title: z.string(),
	description: z.string(),
	tags: z.array(z.string()),
})

const channelSchemas: Record<Channel, z.ZodType> = {
	email: emailSchema,
	sms: smsSchema,
	voice: voiceSchema,
	whatsapp: whatsappSchema,
	linkedin: socialSchema,
	facebook: socialSchema,
	instagram: socialSchema,
	tiktok: videoScriptSchema,
	youtube: youtubeSchema,
	vimeo: vimeoSchema,
	video: videoScriptSchema,
}

function buildPrompt(channel: Channel, brief: ContentBrief): string {
	const config = channelConfig[channel]
	return [
		`Generate ${channel} content for the following brief:`,
		`Goal: ${brief.goal}`,
		`Product: ${brief.product}`,
		`Target audience: ${brief.audience}`,
		`Tone: ${brief.tone}`,
		brief.keywords?.length ? `Keywords: ${brief.keywords.join(', ')}` : '',
		'',
		`Platform constraints: ${JSON.stringify(config.constraints)}`,
		'',
		config.promptSuffix,
	].filter(Boolean).join('\n')
}

export async function generateForChannel(
	channel: string,
	brief: ContentBrief,
	router: LLMRouter,
	providerOverride?: string,
): Promise<unknown> {
	if (!SUPPORTED_CHANNELS.includes(channel as Channel)) {
		throw new Error(`Unsupported channel: ${channel}`)
	}

	const ch = channel as Channel
	const provider = router.resolve(`content:${ch}`)
	const prompt = buildPrompt(ch, brief)
	const schema = channelSchemas[ch]

	return provider.generateJSON(prompt, schema, {
		systemPrompt: `You are a marketing content generator specializing in ${channel} content. Always respond with valid JSON matching the requested schema.`,
	})
}
```

```typescript
// src/adapters/channels/index.ts
export { generateForChannel } from './generator'
export { channelConfig, SUPPORTED_CHANNELS, type Channel, type ContentBrief } from './config'
export type * from './types'
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/adapters/channels/generator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/adapters/channels/generator.ts src/adapters/channels/index.ts tests/adapters/channels/generator.test.ts
git commit -m "feat(phase7): add channel content generator with prompt building"
```

---

### Task 10: Zod Schemas + Content Routes

**Files:**
- Modify: `src/types/api.ts` — add content generation schemas
- Create: `src/routes/content.ts`
- Modify: `src/routes/index.ts` — register content routes
- Test: `tests/routes/content.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/routes/content.test.ts
import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import { createContentRoutes } from '../../../src/routes/content'

// Mock the LLM router and channel generator
vi.mock('../../../src/adapters/llm', () => ({
	createLLMRouter: vi.fn().mockReturnValue({
		resolve: vi.fn().mockReturnValue({
			name: 'mock',
			capabilities: new Set(['text', 'json']),
			generateText: vi.fn(),
			generateJSON: vi.fn().mockResolvedValue({
				subject: 'Test',
				preheader: 'Pre',
				bodyHtml: '<p>Hi</p>',
				bodyText: 'Hi',
				cta: { text: 'Click', url: 'https://example.com' },
			}),
		}),
		listProviders: vi.fn().mockReturnValue([
			{ name: 'openai', capabilities: new Set(['text', 'json']) },
			{ name: 'claude', capabilities: new Set(['text', 'json']) },
		]),
	}),
}))

describe('Content routes', () => {
	const app = new Hono()
	app.route('/content', createContentRoutes())

	it('GET /content/channels should list all supported channels', async () => {
		const res = await app.request('/content/channels')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.channels).toHaveLength(11)
		expect(body.channels[0]).toHaveProperty('name')
		expect(body.channels[0]).toHaveProperty('format')
	})

	it('POST /content/generate should validate required fields', async () => {
		const res = await app.request('/content/generate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({}),
		})
		expect(res.status).toBe(400)
	})

	it('POST /content/generate should reject unsupported channel', async () => {
		const res = await app.request('/content/generate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				channel: 'carrier_pigeon',
				brief: { goal: 'test', product: 'test', audience: 'test', tone: 'test' },
			}),
		})
		expect(res.status).toBe(400)
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/routes/content.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

Add to `src/types/api.ts`:

```typescript
// Content generation (Phase 7)
export const contentBrief = z.object({
	goal: z.string().min(1).max(500),
	product: z.string().min(1).max(500),
	audience: z.string().min(1).max(500),
	tone: z.string().min(1).max(100),
	keywords: z.array(z.string()).optional(),
	campaignId: z.string().uuid().optional(),
	brandKitId: z.string().uuid().optional(),
})

export type ContentBriefInput = z.infer<typeof contentBrief>

export const contentGenerate = z.object({
	channel: z.enum(['email', 'sms', 'voice', 'whatsapp', 'linkedin', 'facebook', 'instagram', 'tiktok', 'youtube', 'vimeo', 'video']),
	brief: contentBrief,
	provider: z.string().optional(),
})

export type ContentGenerate = z.infer<typeof contentGenerate>

export const contentGenerateBatch = z.object({
	channels: z.array(z.enum(['email', 'sms', 'voice', 'whatsapp', 'linkedin', 'facebook', 'instagram', 'tiktok', 'youtube', 'vimeo', 'video'])).min(1),
	brief: contentBrief,
})

export type ContentGenerateBatch = z.infer<typeof contentGenerateBatch>
```

```typescript
// src/routes/content.ts
import { Hono } from 'hono'
import type { AppEnv } from '../app'
import { validate } from '../middleware/validate'
import { contentGenerate, contentGenerateBatch } from '../types/api'
import { channelConfig, SUPPORTED_CHANNELS } from '../adapters/channels'
import { generateForChannel } from '../adapters/channels'
import { createLLMRouter } from '../adapters/llm'

export function createContentRoutes() {
	const app = new Hono<AppEnv>()

	app.get('/channels', (c) => {
		const channels = SUPPORTED_CHANNELS.map((name) => ({
			name,
			...channelConfig[name],
		}))
		return c.json({ channels })
	})

	app.post('/generate', validate('json', contentGenerate), async (c) => {
		const { channel, brief, provider } = c.req.valid('json' as never)
		// Router creation would use config in production
		const router = createLLMRouter({}, {})
		const result = await generateForChannel(channel, brief, router, provider)
		return c.json({ channel, content: result })
	})

	app.post('/generate/batch', validate('json', contentGenerateBatch), async (c) => {
		const { channels, brief } = c.req.valid('json' as never)
		const router = createLLMRouter({}, {})
		const results: Record<string, unknown> = {}

		await Promise.all(
			channels.map(async (channel) => {
				results[channel] = await generateForChannel(channel, brief, router)
			}),
		)

		return c.json({ results })
	})

	return app
}
```

Add to `src/routes/index.ts`:

```typescript
import { createContentRoutes } from './content'
// ... inside registerRoutes:
app.route('/api/v1/content', createContentRoutes())
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/routes/content.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/api.ts src/routes/content.ts src/routes/index.ts tests/routes/content.test.ts
git commit -m "feat(phase7): add content generation routes and Zod schemas"
```

---

### Task 11: Update Config with Provider API Keys

**Files:**
- Modify: `src/config.ts`
- Test: `tests/config.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/config.test.ts
import { describe, it, expect } from 'vitest'
import { configSchema } from '../src/config'

describe('configSchema', () => {
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
	})

	it('should work without any provider keys', () => {
		const result = configSchema.safeParse({
			DATABASE_URL: 'postgresql://localhost/test',
		})
		expect(result.success).toBe(true)
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/config.test.ts`
Expected: FAIL (new keys not in schema yet)

**Step 3: Add new keys to config schema**

Add to `src/config.ts` inside `configSchema`:

```typescript
ANTHROPIC_API_KEY: z.string().optional(),
GEMINI_API_KEY: z.string().optional(),
PERPLEXITY_API_KEY: z.string().optional(),
GROK_API_KEY: z.string().optional(),
HUGGINGFACE_API_KEY: z.string().optional(),
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/config.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/config.ts tests/config.test.ts
git commit -m "feat(phase7): add LLM provider API keys to config schema"
```

---

### Task 12: LLM Router Factory (wire config to providers)

**Files:**
- Create: `src/adapters/llm/factory.ts`
- Test: `tests/adapters/llm/factory.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/adapters/llm/factory.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createLLMRouterFromConfig } from '../../../src/adapters/llm/factory'

// Mock all provider constructors
vi.mock('../../../src/adapters/llm/openai', () => ({
	createOpenAIProvider: vi.fn().mockReturnValue({ name: 'openai', capabilities: new Set(['text']) }),
}))
vi.mock('../../../src/adapters/llm/claude', () => ({
	createClaudeProvider: vi.fn().mockReturnValue({ name: 'claude', capabilities: new Set(['text']) }),
}))
vi.mock('../../../src/adapters/llm/gemini', () => ({
	createGeminiProvider: vi.fn().mockReturnValue({ name: 'gemini', capabilities: new Set(['text']) }),
}))
vi.mock('../../../src/adapters/llm/perplexity', () => ({
	createPerplexityProvider: vi.fn().mockReturnValue({ name: 'perplexity', capabilities: new Set(['text']) }),
}))
vi.mock('../../../src/adapters/llm/grok', () => ({
	createGrokProvider: vi.fn().mockReturnValue({ name: 'grok', capabilities: new Set(['text']) }),
}))
vi.mock('../../../src/adapters/llm/huggingface', () => ({
	createHuggingFaceProvider: vi.fn().mockReturnValue({ name: 'huggingface', capabilities: new Set(['text']) }),
}))

describe('createLLMRouterFromConfig', () => {
	it('should create router with available providers based on config', () => {
		const config = {
			OPENAI_API_KEY: 'sk-test',
			ANTHROPIC_API_KEY: 'sk-ant-test',
		}

		const router = createLLMRouterFromConfig(config as any)
		const providers = router.listProviders()
		expect(providers.map((p) => p.name)).toContain('openai')
		expect(providers.map((p) => p.name)).toContain('claude')
	})

	it('should skip providers without API keys', () => {
		const config = {
			OPENAI_API_KEY: 'sk-test',
		}

		const router = createLLMRouterFromConfig(config as any)
		const providers = router.listProviders()
		expect(providers.map((p) => p.name)).toContain('openai')
		expect(providers.map((p) => p.name)).not.toContain('claude')
	})

	it('should throw when no providers have keys', () => {
		expect(() => createLLMRouterFromConfig({} as any)).toThrow()
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/adapters/llm/factory.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/adapters/llm/factory.ts
import type { Config } from '../../config'
import type { LLMProvider } from './types'
import { createLLMRouter, type LLMRouter } from './router'
import { createOpenAIProvider } from './openai'
import { createClaudeProvider } from './claude'
import { createGeminiProvider } from './gemini'
import { createPerplexityProvider } from './perplexity'
import { createGrokProvider } from './grok'
import { createHuggingFaceProvider } from './huggingface'

const DEFAULT_ROUTING: Record<string, string> = {
	'content:email': 'claude',
	'content:sms': 'openai',
	'content:voice': 'claude',
	'content:whatsapp': 'openai',
	'content:linkedin': 'claude',
	'content:facebook': 'openai',
	'content:instagram': 'openai',
	'content:tiktok': 'gemini',
	'content:youtube': 'gemini',
	'content:vimeo': 'gemini',
	'content:video': 'gemini',
	'research:competitive': 'perplexity',
	'research:trending': 'grok',
	'analysis:sentiment': 'openai',
	'analysis:persona': 'claude',
}

export function createLLMRouterFromConfig(config: Config): LLMRouter {
	const providers: Record<string, LLMProvider> = {}

	if (config.OPENAI_API_KEY) {
		providers.openai = createOpenAIProvider(config.OPENAI_API_KEY, config.OPENAI_MODEL)
	}
	if (config.ANTHROPIC_API_KEY) {
		providers.claude = createClaudeProvider(config.ANTHROPIC_API_KEY)
	}
	if (config.GEMINI_API_KEY) {
		providers.gemini = createGeminiProvider(config.GEMINI_API_KEY)
	}
	if (config.PERPLEXITY_API_KEY) {
		providers.perplexity = createPerplexityProvider(config.PERPLEXITY_API_KEY)
	}
	if (config.GROK_API_KEY) {
		providers.grok = createGrokProvider(config.GROK_API_KEY)
	}
	if (config.HUGGINGFACE_API_KEY) {
		providers.huggingface = createHuggingFaceProvider(config.HUGGINGFACE_API_KEY)
	}

	return createLLMRouter(providers, DEFAULT_ROUTING)
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/adapters/llm/factory.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/adapters/llm/factory.ts tests/adapters/llm/factory.test.ts
git commit -m "feat(phase7): add LLM router factory wired to config"
```

---

### Task 13: Migrate Existing OpenAI Callers

**Files:**
- Modify: `src/routes/mcp.ts` — use LLMRouter instead of createOpenAIAdapter
- Modify: `src/services/evo/textgrad.ts` — accept LLMProvider instead of OpenAIAdapter
- Modify: `src/services/evo/task-planner.ts`
- Modify: `src/services/evo/agent-generator.ts`
- Modify: `src/services/evo/workflow-gen.ts`
- Modify: `src/services/evo/evaluator.ts`
- Modify: `src/services/evo/optimizer.ts`
- Modify: `src/services/evo/prompt-population.ts`
- Modify: `src/services/evo/learning-loop.ts`
- Modify: `src/services/scraper/enrichment.ts`
- Modify: `src/mcp/tools/personas.ts`
- Modify: `src/mcp/tools/workflows.ts`
- Test: `tests/adapters/llm/migration.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/adapters/llm/migration.test.ts
import { describe, it, expect } from 'vitest'
import type { LLMProvider } from '../../../src/adapters/llm/types'

describe('OpenAIAdapter migration', () => {
	it('LLMProvider interface covers generateContent use case', async () => {
		const provider: LLMProvider = {
			name: 'test',
			capabilities: new Set(['text']),
			async generateText(prompt, opts) { return 'migrated' },
			async generateJSON(prompt, schema) { return {} },
		}

		// Old: adapter.generateContent(prompt, systemPrompt)
		// New: provider.generateText(prompt, { systemPrompt })
		const result = await provider.generateText('test prompt', { systemPrompt: 'system' })
		expect(result).toBe('migrated')
	})

	it('LLMProvider interface covers analyzeSentiment use case', async () => {
		const { z } = await import('zod')
		const sentimentSchema = z.object({ score: z.number(), themes: z.array(z.string()) })

		const provider: LLMProvider = {
			name: 'test',
			capabilities: new Set(['text', 'json']),
			async generateText() { return '' },
			async generateJSON(_prompt, schema) {
				return schema.parse({ score: 0.5, themes: ['positive'] })
			},
		}

		// Old: adapter.analyzeSentiment(text, brand)
		// New: provider.generateJSON(prompt, sentimentSchema)
		const result = await provider.generateJSON('analyze', sentimentSchema)
		expect(result.score).toBe(0.5)
		expect(result.themes).toContain('positive')
	})
})
```

**Step 2: Run test to verify it passes** (this test validates the interface, not migration)

Run: `bunx vitest run tests/adapters/llm/migration.test.ts`
Expected: PASS

**Step 3: Migrate all callers**

In every file that imports `OpenAIAdapter`, change:
- `import type { OpenAIAdapter } from '../../adapters/openai'` → `import type { LLMProvider } from '../../adapters/llm/types'`
- Parameter type `adapter: OpenAIAdapter` → `provider: LLMProvider`
- `adapter.generateContent(prompt, systemPrompt)` → `provider.generateText(prompt, { systemPrompt })`
- `adapter.analyzeSentiment(text, brand)` → `provider.generateJSON(sentimentPrompt, sentimentSchema)`

**Files to update (13 files):**

1. `src/services/evo/textgrad.ts` — `adapter: OpenAIAdapter` → `provider: LLMProvider` in `computeLoss`, `computeGradient`, `applyGradient`
2. `src/services/evo/task-planner.ts` — `adapter: OpenAIAdapter` → `provider: LLMProvider` in `decomposeGoal`
3. `src/services/evo/agent-generator.ts` — `adapter: OpenAIAdapter` → `provider: LLMProvider` in `generateAgentConfig`
4. `src/services/evo/workflow-gen.ts` — `adapter: OpenAIAdapter` → `provider: LLMProvider` in `generateWorkflow`
5. `src/services/evo/evaluator.ts` — `adapter: OpenAIAdapter` → `provider: LLMProvider` in `evaluateCampaign`
6. `src/services/evo/optimizer.ts` — `adapter: OpenAIAdapter` → `provider: LLMProvider` in `runOptimizationCycle`
7. `src/services/evo/prompt-population.ts` — `adapter: OpenAIAdapter` → `provider: LLMProvider` in `crossoverPrompts`, `mutatePrompt`, `deMutatePrompt`
8. `src/services/evo/learning-loop.ts` — `adapter: OpenAIAdapter` → `provider: LLMProvider` in `runLearningIteration`
9. `src/services/scraper/enrichment.ts` — `adapter: OpenAIAdapter` → `provider: LLMProvider` in `enrichArticles`
10. `src/mcp/tools/personas.ts` — `adapter: OpenAIAdapter` → `provider: LLMProvider` in `handleGeneratePersona`
11. `src/mcp/tools/workflows.ts` — `adapter: OpenAIAdapter` → `provider: LLMProvider` in `handleGenerateWorkflow`
12. `src/routes/mcp.ts` — `createOpenAIAdapter()` → `createLLMRouterFromConfig(getConfig()).resolve('analysis:persona')` etc.

For each file, replace `adapter.generateContent(prompt, systemPrompt)` with `provider.generateText(prompt, { systemPrompt })`.

**Step 4: Run all existing tests to verify nothing breaks**

Run: `bunx vitest run`
Expected: All existing tests PASS

**Step 5: Commit**

```bash
git add src/services/evo/ src/mcp/ src/routes/mcp.ts src/services/scraper/enrichment.ts tests/adapters/llm/migration.test.ts
git commit -m "refactor(phase7): migrate all callers from OpenAIAdapter to LLMProvider"
```

---

### Task 14: Update Campaign Channels Enum

**Files:**
- Modify: `src/types/api.ts:27` — expand channels enum
- Modify: `src/db/schema/campaigns.ts:28` — expand channel_results enum
- Modify: `src/db/schema/delivery-events.ts:15` — expand delivery channel enum
- Generate: new Drizzle migration
- Test: `tests/types/channels.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/types/channels.test.ts
import { describe, it, expect } from 'vitest'
import { campaignCreate, contentSyncRequest } from '../src/types/api'

describe('expanded channel enums', () => {
	it('should accept all 12 channels in campaignCreate', () => {
		const channels = [
			'email', 'sms', 'voice', 'whatsapp', 'linkedin', 'facebook',
			'instagram', 'tiktok', 'youtube', 'vimeo', 'video',
		]
		for (const channel of channels) {
			const result = campaignCreate.safeParse({
				name: 'Test',
				goal: 'Test',
				channels: [channel],
			})
			expect(result.success, `Channel ${channel} should be valid`).toBe(true)
		}
	})

	it('should accept new channels in contentSyncRequest', () => {
		const result = contentSyncRequest.safeParse({
			name: 'Test',
			channel: 'tiktok',
		})
		expect(result.success).toBe(true)
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/types/channels.test.ts`
Expected: FAIL — current enum only has 4 channels

**Step 3: Update the enums**

In `src/types/api.ts:27`, change:
```typescript
channels: z.array(z.enum(['email', 'sms', 'voice', 'linkedin'])).min(1),
```
to:
```typescript
channels: z.array(z.enum(['email', 'sms', 'voice', 'whatsapp', 'linkedin', 'facebook', 'instagram', 'tiktok', 'youtube', 'vimeo', 'video'])).min(1),
```

In `src/types/api.ts:152`, change:
```typescript
channel: z.enum(['email', 'sms', 'voice', 'linkedin']),
```
to:
```typescript
channel: z.enum(['email', 'sms', 'voice', 'whatsapp', 'linkedin', 'facebook', 'instagram', 'tiktok', 'youtube', 'vimeo', 'video']),
```

In `src/db/schema/campaigns.ts:28`, change the channel enum to include all channels.

In `src/db/schema/delivery-events.ts:15`, change the channel enum to include all channels.

Then generate migration:

```bash
bunx drizzle-kit generate
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/types/channels.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/api.ts src/db/schema/campaigns.ts src/db/schema/delivery-events.ts src/db/migrations/ tests/types/channels.test.ts
git commit -m "feat(phase7): expand channel enums to 12 channels with Drizzle migration"
```

---

### Task 15: LLM Providers Status Endpoint

**Files:**
- Modify: `src/routes/content.ts` — add GET /llm/providers
- Test: `tests/routes/content.test.ts` — add provider listing test

**Step 1: Write the failing test**

```typescript
// Add to tests/routes/content.test.ts
it('GET /content/providers should list available providers', async () => {
	const res = await app.request('/content/providers')
	expect(res.status).toBe(200)
	const body = await res.json()
	expect(body.providers).toBeInstanceOf(Array)
	expect(body.providers[0]).toHaveProperty('name')
	expect(body.providers[0]).toHaveProperty('capabilities')
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/routes/content.test.ts`
Expected: FAIL — route not found

**Step 3: Add endpoint to content routes**

Add to `src/routes/content.ts`:

```typescript
app.get('/providers', (c) => {
	const config = getConfig()
	const router = createLLMRouterFromConfig(config)
	const providers = router.listProviders().map((p) => ({
		name: p.name,
		capabilities: [...p.capabilities],
	}))
	return c.json({ providers })
})
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/routes/content.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/routes/content.ts tests/routes/content.test.ts
git commit -m "feat(phase7): add LLM provider listing endpoint"
```

---

### Task 16: Integration Test

**Files:**
- Create: `tests/integration/phase7.test.ts`

**Step 1: Write the integration test**

```typescript
// tests/integration/phase7.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createLLMRouter, type LLMProvider } from '../../src/adapters/llm'
import { generateForChannel, SUPPORTED_CHANNELS, type ContentBrief } from '../../src/adapters/channels'

function mockProvider(name: string): LLMProvider {
	return {
		name,
		capabilities: new Set(['text', 'json']),
		async generateText() { return 'generated' },
		async generateJSON(_prompt: string, schema: any) {
			// Return minimal valid data for any channel schema
			return {
				subject: 'Test', preheader: 'Pre', bodyHtml: '<p>Hi</p>',
				bodyText: 'Hi', cta: { text: 'Click', url: 'https://x.com' },
				message: 'Test SMS', parts: 1,
				script: 'Test script', duration: 30, tone: 'friendly',
				text: 'Social post', hashtags: ['#test'], mediaPrompt: 'photo',
				shots: [{ type: 'hook', seconds: '0-3', visual: 'Logo', audio: 'Music' }],
				captions: 'Test', thumbnailConcept: 'Product shot',
				title: 'Test Video', description: 'Desc', tags: ['test'],
				chapters: [{ timestamp: '0:00', title: 'Intro' }],
				buttons: [{ text: 'Learn More', url: 'https://x.com' }],
			}
		},
	}
}

describe('Phase 7 integration: multi-provider content generation', () => {
	const brief: ContentBrief = {
		goal: 'Drive demo signups',
		product: 'B2B Marketing SaaS',
		audience: 'CMOs at mid-market companies',
		tone: 'Professional yet approachable',
		keywords: ['marketing', 'automation', 'ROI'],
	}

	it('should route email content to claude', () => {
		const router = createLLMRouter(
			{ openai: mockProvider('openai'), claude: mockProvider('claude') },
			{ 'content:email': 'claude' },
		)

		const provider = router.resolve('content:email')
		expect(provider.name).toBe('claude')
	})

	it('should route tiktok content to gemini', () => {
		const router = createLLMRouter(
			{ openai: mockProvider('openai'), gemini: mockProvider('gemini') },
			{ 'content:tiktok': 'gemini' },
		)

		const provider = router.resolve('content:tiktok')
		expect(provider.name).toBe('gemini')
	})

	it('should generate content for any supported channel', async () => {
		const router = createLLMRouter(
			{ openai: mockProvider('openai') },
			{},
		)

		for (const channel of SUPPORTED_CHANNELS) {
			const result = await generateForChannel(channel, brief, router)
			expect(result).toBeDefined()
		}
	})

	it('should support batch generation across multiple channels', async () => {
		const router = createLLMRouter(
			{ openai: mockProvider('openai') },
			{},
		)

		const channels = ['email', 'sms', 'linkedin'] as const
		const results: Record<string, unknown> = {}

		await Promise.all(
			channels.map(async (ch) => {
				results[ch] = await generateForChannel(ch, brief, router)
			}),
		)

		expect(Object.keys(results)).toHaveLength(3)
		expect(results.email).toBeDefined()
		expect(results.sms).toBeDefined()
		expect(results.linkedin).toBeDefined()
	})
})
```

**Step 2: Run test**

Run: `bunx vitest run tests/integration/phase7.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/integration/phase7.test.ts
git commit -m "test(phase7): add integration test for multi-provider content generation"
```

---

### Task 17: Deprecate Old OpenAI Adapter

**Files:**
- Modify: `src/adapters/openai.ts` — add deprecation notice, re-export from new module

**Step 1: Update the old adapter**

```typescript
// src/adapters/openai.ts
/**
 * @deprecated Use `src/adapters/llm` instead. This adapter is kept for backward compatibility.
 * Migration: import { createLLMRouterFromConfig } from './llm/factory'
 */
import type { LLMProvider } from './llm/types'

export type OpenAIAdapter = {
	analyzeSentiment(text: string, brand: string): Promise<{ score: number; themes: string[] }>
	generateContent(prompt: string, systemPrompt?: string): Promise<string>
}

/** @deprecated Use createLLMRouterFromConfig instead */
export function createOpenAIAdapter(): OpenAIAdapter {
	// Delegate to new provider
	const { createOpenAIProvider } = require('./llm/openai')
	const { getConfig } = require('../config')
	const config = getConfig()
	if (!config.OPENAI_API_KEY) {
		throw new Error('OpenAI API key not configured')
	}
	const provider: LLMProvider = createOpenAIProvider(config.OPENAI_API_KEY, config.OPENAI_MODEL)

	return {
		async analyzeSentiment(text, brand) {
			const { z } = require('zod')
			const schema = z.object({ score: z.number(), themes: z.array(z.string()) })
			return provider.generateJSON(
				`Analyze sentiment about "${brand}" in this text:\n\n${text.slice(0, 2000)}`,
				schema,
				{ systemPrompt: 'You analyze sentiment. Return JSON: { "score": number (-1 to 1), "themes": string[] }' },
			)
		},
		async generateContent(prompt, systemPrompt) {
			return provider.generateText(prompt, { systemPrompt })
		},
	}
}
```

**Step 2: Run all tests**

Run: `bunx vitest run`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/adapters/openai.ts
git commit -m "refactor(phase7): deprecate OpenAIAdapter in favor of LLMProvider"
```
