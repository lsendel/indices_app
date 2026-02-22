import type { OpenAIAdapter } from '../../adapters/openai'
import { evaluateCampaign, type CampaignStats, type EvaluationResult } from './evaluator'
import { runOptimizationCycle, type OptimizationResult } from './optimizer'
import type { ScoredPrompt } from './prompt-population'

export interface LearningContext {
	currentPrompt: string
	campaignOutput: string
	goal: string
	campaignStats: CampaignStats
	promptPopulation: ScoredPrompt[]
	strategy: 'textgrad' | 'ga' | 'de' | 'hybrid'
}

export interface LearningResult {
	evaluation: EvaluationResult
	optimization: OptimizationResult
	candidatePrompts: string[]
}

/** Run one full learning iteration: evaluate campaign → optimize prompts → collect candidates. */
export async function runLearningIteration(
	adapter: OpenAIAdapter,
	context: LearningContext,
): Promise<LearningResult> {
	const evaluation = await evaluateCampaign(
		adapter,
		context.campaignStats,
		context.goal,
	)

	const optimization = await runOptimizationCycle(adapter, {
		currentPrompt: context.currentPrompt,
		output: context.campaignOutput,
		goal: context.goal,
		population: context.promptPopulation,
		strategy: context.strategy,
	})

	const candidatePrompts: string[] = []
	if (optimization.textgradPrompt) {
		candidatePrompts.push(optimization.textgradPrompt)
	}
	candidatePrompts.push(...optimization.gaChildren)

	return { evaluation, optimization, candidatePrompts }
}
