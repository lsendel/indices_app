import type { OpenAIAdapter } from '../../adapters/openai'
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

export async function decomposeGoal(
	adapter: OpenAIAdapter,
	goal: string,
): Promise<WorkFlowNode[]> {
	const response = await adapter.generateContent(
		`Decompose this marketing goal into sub-tasks:\n\n${goal}`,
		SYSTEM_PROMPT,
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
		return []
	}
}
