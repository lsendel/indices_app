import type { OpenAIAdapter } from '../../adapters/openai'

export interface LossInput {
	prompt: string
	output: string
	goal: string
}

export interface LossResult {
	loss: number
	analysis: string
}

export interface GradientInput {
	prompt: string
	lossAnalysis: string
}

export interface GradientResult {
	gradient: string
	suggestedPrompt: string
}

export interface ApplyGradientInput {
	currentPrompt: string
	gradient: string
}

/**
 * Forward pass: LLM evaluates output quality relative to goal.
 * @param adapter - OpenAI adapter for LLM calls
 * @param input - Prompt, output, and goal to evaluate
 * @returns Loss score in [0, 1] (0=perfect, 1=terrible) and analysis text
 */
export async function computeLoss(adapter: OpenAIAdapter, input: LossInput): Promise<LossResult> {
	const systemPrompt = `You evaluate the quality of AI-generated marketing content. Return JSON: { "loss": number (0=perfect, 1=terrible), "analysis": "what went wrong" }`
	const prompt = `Goal: ${input.goal}
Prompt used: ${input.prompt}
Output produced: ${input.output.slice(0, 2000)}

Rate the quality (0=perfect match to goal, 1=completely wrong).`

	try {
		const response = await adapter.generateContent(prompt, systemPrompt)
		const parsed = JSON.parse(response) as { loss: number; analysis: string }
		return {
			loss: Math.max(0, Math.min(1, parsed.loss)),
			analysis: parsed.analysis,
		}
	} catch (e) {
		if (!(e instanceof SyntaxError)) throw e
		console.warn('computeLoss: failed to parse LLM response', { goal: input.goal, error: e.message })
		return { loss: 1, analysis: 'Failed to evaluate output' }
	}
}

/**
 * Backward pass: LLM suggests how to improve the prompt based on the loss analysis.
 * @param adapter - OpenAI adapter for LLM calls
 * @param input - Current prompt and loss analysis to derive gradient from
 * @returns Gradient description and suggested improved prompt
 */
export async function computeGradient(
	adapter: OpenAIAdapter,
	input: GradientInput,
): Promise<GradientResult> {
	const systemPrompt = `You improve AI prompts based on quality feedback. Return JSON: { "gradient": "description of what to change", "suggestedPrompt": "improved prompt" }`
	const prompt = `Current prompt: ${input.prompt}
Quality issues: ${input.lossAnalysis}

Suggest specific improvements.`

	try {
		const response = await adapter.generateContent(prompt, systemPrompt)
		return JSON.parse(response) as GradientResult
	} catch (e) {
		if (!(e instanceof SyntaxError)) throw e
		console.warn('computeGradient: failed to parse LLM response', { error: e.message })
		return { gradient: 'Unable to compute gradient', suggestedPrompt: input.prompt }
	}
}

/**
 * Apply gradient: LLM rewrites the prompt incorporating improvement suggestions.
 * @param adapter - OpenAI adapter for LLM calls
 * @param input - Current prompt and gradient to apply
 * @returns Improved prompt text
 */
export async function applyGradient(
	adapter: OpenAIAdapter,
	input: ApplyGradientInput,
): Promise<string> {
	const systemPrompt = 'You rewrite prompts to incorporate improvements. Return ONLY the improved prompt text, nothing else.'
	const prompt = `Current prompt: ${input.currentPrompt}
Improvements to apply: ${input.gradient}

Rewrite the prompt incorporating these improvements.`

	return adapter.generateContent(prompt, systemPrompt)
}
