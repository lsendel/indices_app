import { describe, it, expect } from 'vitest'
import type {
	Parameter,
	WorkFlowNode,
	WorkFlowEdge,
	WorkFlowGraph,
	NodeStatus,
} from '../../src/types/workflow'
import type {
	AgentConfig,
	AgentTask,
	TaskResult,
} from '../../src/types/agents'

describe('workflow types', () => {
	it('creates a valid Parameter', () => {
		const param: Parameter = { name: 'topic', description: 'Marketing topic', required: true }
		expect(param.name).toBe('topic')
		expect(param.required).toBe(true)
	})

	it('creates a valid WorkFlowNode', () => {
		const node: WorkFlowNode = {
			name: 'research',
			description: 'Research target market',
			inputs: [{ name: 'goal', description: 'Campaign goal', required: true }],
			outputs: [{ name: 'insights', description: 'Market insights', required: true }],
			status: 'pending',
			agentId: null,
		}
		expect(node.status).toBe('pending')
		expect(node.inputs).toHaveLength(1)
	})

	it('creates a valid WorkFlowEdge', () => {
		const edge: WorkFlowEdge = { source: 'research', target: 'draft', priority: 1 }
		expect(edge.source).toBe('research')
	})

	it('creates a valid WorkFlowGraph', () => {
		const graph: WorkFlowGraph = {
			goal: 'Launch email campaign',
			nodes: [],
			edges: [],
		}
		expect(graph.goal).toBe('Launch email campaign')
	})

	it('NodeStatus covers all valid states', () => {
		const statuses: NodeStatus[] = ['pending', 'running', 'completed', 'failed', 'awaiting_approval']
		expect(statuses).toHaveLength(5)
	})
})

describe('agent types', () => {
	it('creates a valid AgentConfig', () => {
		const config: AgentConfig = {
			name: 'researcher',
			description: 'Researches market data',
			systemPrompt: 'You are a market researcher.',
			instructionPrompt: 'Analyze the following market.',
			inputs: [{ name: 'market', description: 'Target market', required: true }],
			outputs: [{ name: 'report', description: 'Market report', required: true }],
		}
		expect(config.name).toBe('researcher')
	})

	it('creates a valid AgentTask', () => {
		const task: AgentTask = {
			nodeName: 'research',
			agentConfig: {
				name: 'researcher',
				description: 'Researches markets',
				systemPrompt: 'You are a researcher.',
				instructionPrompt: 'Research this.',
				inputs: [],
				outputs: [],
			},
			inputValues: { goal: 'Increase sign-ups' },
		}
		expect(task.nodeName).toBe('research')
	})

	it('creates a valid TaskResult', () => {
		const result: TaskResult = {
			nodeName: 'research',
			success: true,
			outputs: { report: 'Market analysis complete' },
			error: null,
		}
		expect(result.success).toBe(true)
	})
})
