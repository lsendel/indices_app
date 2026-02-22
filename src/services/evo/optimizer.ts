import type { OpenAIAdapter } from '../../adapters/openai'
import { computeLoss, computeGradient, applyGradient } from './textgrad'
import { selectParents, crossoverPrompts, mutatePrompt } from './prompt-population'
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

		textgradPrompt = await applyGradient(adapter, {
			currentPrompt: input.currentPrompt,
			gradient: gradientResult.gradient,
		})
	}

	// GA phase
	if (useGA) {
		const parents = selectParents(input.population, 2)
		const child = await crossoverPrompts(adapter, parents[0].prompt, parents[1].prompt)
		gaChildren.push(child)

		const mutated = await mutatePrompt(adapter, child)
		gaChildren.push(mutated)
	}

	return { textgradPrompt, gaChildren, loss, gradient }
}
