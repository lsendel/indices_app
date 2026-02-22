import type { OpenAIAdapter } from '../../adapters/openai'

export interface ScoredPrompt {
	prompt: string
	score: number
}

/** Tournament selection: return the top-N candidates by score. */
export function selectParents(population: ScoredPrompt[], count: number): ScoredPrompt[] {
	const sorted = [...population].sort((a, b) => b.score - a.score)
	return sorted.slice(0, Math.min(count, sorted.length))
}

/** GA crossover: combine two parent prompts into a child via LLM. */
export async function crossoverPrompts(
	adapter: OpenAIAdapter,
	parent1: string,
	parent2: string,
): Promise<string> {
	const systemPrompt = 'You combine two marketing prompt strategies into one improved prompt. Return ONLY the combined prompt text.'
	const prompt = `Parent prompt 1: ${parent1}\n\nParent prompt 2: ${parent2}\n\nCombine the best elements of both into a single improved prompt.`

	return adapter.generateContent(prompt, systemPrompt)
}

/** GA mutation: introduce variations into a prompt via LLM. */
export async function mutatePrompt(
	adapter: OpenAIAdapter,
	original: string,
): Promise<string> {
	const systemPrompt = 'You introduce creative variations into marketing prompts while preserving their core intent. Return ONLY the mutated prompt text.'
	const prompt = `Original prompt: ${original}\n\nIntroduce a creative variation — add a new technique, adjust the angle, or enhance the strategy.`

	return adapter.generateContent(prompt, systemPrompt)
}

/** DE mutation: apply differential evolution using donor1-donor2 difference to target. */
export async function deMutatePrompt(
	adapter: OpenAIAdapter,
	input: { target: string; donor1: string; donor2: string },
): Promise<string> {
	const systemPrompt = 'You apply differential evolution to prompts. Identify the innovations in donor1 that are absent in donor2, then apply those innovations to the target. Return ONLY the improved prompt text.'
	const prompt = `Target prompt: ${input.target}
Donor 1 (has innovations): ${input.donor1}
Donor 2 (baseline): ${input.donor2}

Identify what donor1 has that donor2 lacks, then enhance the target with those innovations.`

	return adapter.generateContent(prompt, systemPrompt)
}
