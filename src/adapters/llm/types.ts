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
