import type { LLMProvider } from '../../adapters/llm/types'
import { generateWorkflow } from '../../services/evo/workflow-gen'

export async function handleGenerateWorkflow(goal: string, provider: LLMProvider) {
	return generateWorkflow(provider, goal)
}
