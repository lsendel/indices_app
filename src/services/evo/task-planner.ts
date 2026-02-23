import type { LLMProvider } from '../../adapters/llm/types'
import type { WorkFlowNode } from '../../types/workflow'

const SYSTEM_PROMPT = `You are a marketing task planner. Decompose a marketing goal into a sequence of concrete sub-tasks. Return JSON array:
[{ "name": "snake_case_name", "description": "what this task does", "inputs": [{ "name": "param", "description": "desc", "required": true }], "outputs": [{ "name": "param", "description": "desc", "required": true }] }]
Name outputs so downstream tasks can reference them as inputs (matching names create edges).
Return ONLY the JSON array, no markdown.`

interface RawTask {
	name: string
	description: string
	inputs: { name: string; description: string; required: boolean }[]
	outputs: { name: string; description: string; required: boolean }[]
}

/**
 * Decompose a marketing goal into a sequence of workflow nodes via LLM.
 * @param adapter - OpenAI adapter for LLM calls
 * @param goal - High-level marketing goal to decompose
 * @returns Array of workflow nodes; empty array if LLM returns unparseable output
 */
export async function decomposeGoal(
	provider: LLMProvider,
	goal: string,
): Promise<WorkFlowNode[]> {
	const response = await provider.generateText(
		`Decompose this marketing goal into sub-tasks:\n\n${goal}`,
		{ systemPrompt: SYSTEM_PROMPT },
	)

	try {
		const tasks: RawTask[] = JSON.parse(response)
		if (!Array.isArray(tasks)) return []

		return tasks.map(task => ({
			name: task.name,
			description: task.description,
			inputs: task.inputs ?? [],
			outputs: task.outputs ?? [],
			status: 'pending' as const,
			agentId: null,
		}))
	} catch (e) {
		if (!(e instanceof SyntaxError)) throw e
		console.warn('decomposeGoal: failed to parse LLM response', { goal, error: e.message })
		return []
	}
}
