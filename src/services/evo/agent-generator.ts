import type { OpenAIAdapter } from '../../adapters/openai'
import type { WorkFlowNode } from '../../types/workflow'
import type { AgentConfig } from '../../types/agents'

const SYSTEM_PROMPT = `You generate AI agent configurations for marketing workflow tasks. Given a task description, return JSON:
{ "name": "agent_name", "description": "what this agent does", "systemPrompt": "system prompt for the agent", "instructionPrompt": "instruction prompt template" }
Return ONLY the JSON object, no markdown.`

export async function generateAgentConfig(
	adapter: OpenAIAdapter,
	node: WorkFlowNode,
): Promise<AgentConfig> {
	const prompt = `Generate an agent config for this task:
Name: ${node.name}
Description: ${node.description}
Inputs: ${node.inputs.map(i => i.name).join(', ')}
Outputs: ${node.outputs.map(o => o.name).join(', ')}`

	const response = await adapter.generateContent(prompt, SYSTEM_PROMPT)

	try {
		const parsed = JSON.parse(response) as {
			name: string
			description: string
			systemPrompt: string
			instructionPrompt: string
		}

		return {
			name: parsed.name,
			description: parsed.description,
			systemPrompt: parsed.systemPrompt,
			instructionPrompt: parsed.instructionPrompt,
			inputs: node.inputs,
			outputs: node.outputs,
		}
	} catch {
		return {
			name: node.name,
			description: node.description,
			systemPrompt: `You are an AI agent specialized in: ${node.name}. ${node.description}`,
			instructionPrompt: `Complete the following task: ${node.description}`,
			inputs: node.inputs,
			outputs: node.outputs,
		}
	}
}
