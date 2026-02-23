import type { OpenAIAdapter } from '../../adapters/openai'
import { computeLoss, computeGradient, applyGradient, GRADIENT_FAILURE } from './textgrad'
import { selectParents, crossoverPrompts, mutatePrompt, deMutatePrompt } from './prompt-population'
import type { ScoredPrompt } from './prompt-population'

export interface OptimizationInput {
	currentPrompt: string
	output: string
	goal: string
	population: ScoredPrompt[]
	strategy: 'textgrad' | 'ga' | 'de' | 'hybrid'
}

export interface OptimizationResult {
	textgradPrompt: string | null
	gaChildren: string[]
	loss: number
	gradient: string
}

/**
 * Run one optimization cycle using the selected strategy (TextGrad, GA, DE, or hybrid).
 * @param adapter - OpenAI adapter for LLM calls
 * @param input - Current prompt, output, goal, population, and strategy
 * @returns TextGrad-improved prompt, GA/DE children, loss value, and gradient text
 */
export async function runOptimizationCycle(
	adapter: OpenAIAdapter,
	input: OptimizationInput,
): Promise<OptimizationResult> {
	let textgradPrompt: string | null = null
	let loss = 0
	let gradient = ''
	const gaChildren: string[] = []

	const useTextGrad = input.strategy === 'textgrad' || input.strategy === 'hybrid'
	const useGA = (input.strategy === 'ga' || input.strategy === 'hybrid') && input.population.length >= 2
	const useDE = (input.strategy === 'de' || input.strategy === 'hybrid') && input.population.length >= 3

	// TextGrad phase
	if (useTextGrad) {
		const lossResult = await computeLoss(adapter, {
			prompt: input.currentPrompt,
			output: input.output,
			goal: input.goal,
		})
		loss = lossResult.loss

		const gradientResult = await computeGradient(adapter, {
			prompt: input.currentPrompt,
			lossAnalysis: lossResult.analysis,
		})
		gradient = gradientResult.gradient

		if (gradient === GRADIENT_FAILURE) {
			textgradPrompt = input.currentPrompt
		} else {
			textgradPrompt = await applyGradient(adapter, {
				currentPrompt: input.currentPrompt,
				gradient: gradientResult.gradient,
			})
		}
	}

	// GA phase
	if (useGA) {
		const parents = selectParents(input.population, 2)
		const child = await crossoverPrompts(adapter, parents[0].prompt, parents[1].prompt)
		gaChildren.push(child)

		const mutated = await mutatePrompt(adapter, child)
		gaChildren.push(mutated)
	}

	// DE phase
	if (useDE) {
		const sorted = [...input.population].sort((a, b) => b.score - a.score)
		const deChild = await deMutatePrompt(adapter, {
			target: sorted[0].prompt,
			donor1: sorted[1].prompt,
			donor2: sorted[2].prompt,
		})
		gaChildren.push(deChild)
	}

	return { textgradPrompt, gaChildren, loss, gradient }
}
