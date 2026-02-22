import type { Parameter } from './workflow'

export interface AgentConfig {
	name: string
	description: string
	systemPrompt: string
	instructionPrompt: string
	inputs: Parameter[]
	outputs: Parameter[]
}

export interface AgentTask {
	nodeName: string
	agentConfig: AgentConfig
	inputValues: Record<string, string>
}

export interface TaskResult {
	nodeName: string
	success: boolean
	outputs: Record<string, string>
	error: string | null
}
