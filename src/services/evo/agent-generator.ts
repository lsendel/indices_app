import type { LLMProvider } from '../../adapters/llm/types'
import type { WorkFlowNode } from '../../types/workflow'
import type { AgentConfig } from '../../types/agents'

const SYSTEM_PROMPT = `You generate AI agent configurations for marketing workflow tasks. Given a task description, return JSON:
{ "name": "agent_name", "description": "what this agent does", "systemPrompt": "system prompt for the agent", "instructionPrompt": "instruction prompt template" }
Return ONLY the JSON object, no markdown.`

/**
 * Generate an AI agent configuration for a workflow node via LLM.
 * @param adapter - OpenAI adapter for LLM calls
 * @param node - Workflow node to generate an agent for
 * @returns Agent config from LLM, or a fallback config derived from the node on parse failure
 */
export async function generateAgentConfig(
	provider: LLMProvider,
	node: WorkFlowNode,
): Promise<AgentConfig> {
	const prompt = `Generate an agent config for this task:
Name: ${node.name}
Description: ${node.description}
Inputs: ${node.inputs.map(i => i.name).join(', ')}
Outputs: ${node.outputs.map(o => o.name).join(', ')}`

	const response = await provider.generateText(prompt, { systemPrompt: SYSTEM_PROMPT })

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
	} catch (e) {
		if (!(e instanceof SyntaxError)) throw e
		console.warn('generateAgentConfig: failed to parse LLM response, using fallback', { node: node.name, error: e.message })
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
