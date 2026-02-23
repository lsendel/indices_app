import type { OpenAIAdapter } from '../../adapters/openai'
import { generateWorkflow } from '../../services/evo/workflow-gen'

export async function handleGenerateWorkflow(goal: string, adapter: OpenAIAdapter) {
	return generateWorkflow(adapter, goal)
}
