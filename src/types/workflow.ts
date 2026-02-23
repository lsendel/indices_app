export interface Parameter {
	name: string
	description: string
	required: boolean
}

export type NodeStatus = 'pending' | 'running' | 'completed' | 'failed' | 'awaiting_approval'

export interface WorkFlowNode {
	id?: string
	name: string
	description: string
	inputs: Parameter[]
	outputs: Parameter[]
	status: NodeStatus
	agentId: string | null
}

export interface WorkFlowEdge {
	source: string
	target: string
	priority: number
}

export interface WorkFlowGraph {
	goal: string
	nodes: WorkFlowNode[]
	edges: WorkFlowEdge[]
}
