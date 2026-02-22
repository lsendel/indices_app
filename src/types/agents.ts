import type { Parameter } from './workflow'

export interface AgentConfig {
	id?: string
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

export type TaskResult =
	| { nodeName: string; status: 'success'; outputs: Record<string, string> }
	| { nodeName: string; status: 'error'; error: string }
