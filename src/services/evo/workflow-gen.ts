import type { LLMProvider } from '../../adapters/llm/types'
import type { WorkFlowGraph } from '../../types/workflow'
import type { AgentConfig } from '../../types/agents'
import { decomposeGoal } from './task-planner'
import { generateAgentConfig } from './agent-generator'
import { inferEdges, validateGraph } from './workflow-graph'

export interface GeneratedWorkflow {
	goal: string
	graph: WorkFlowGraph
	agents: AgentConfig[]
}

/**
 * Generate a complete workflow from a marketing goal: decompose → infer edges → validate → assign agents.
 * @param adapter - OpenAI adapter for LLM calls
 * @param goal - High-level marketing goal
 * @returns Generated workflow with graph and agent configs
 */
export async function generateWorkflow(
	provider: LLMProvider,
	goal: string,
): Promise<GeneratedWorkflow> {
	const nodes = await decomposeGoal(provider, goal)

	if (nodes.length === 0) {
		return { goal, graph: { goal, nodes: [], edges: [] }, agents: [] }
	}

	const edges = inferEdges(nodes)
	const validation = validateGraph(nodes, edges)

	if (!validation.valid) {
		console.warn(`Generated graph is invalid: ${validation.error}. Using nodes without edges.`)
		return {
			goal,
			graph: { goal, nodes, edges: [] },
			agents: await Promise.all(nodes.map(n => generateAgentConfig(provider, n))),
		}
	}

	const agents = await Promise.all(nodes.map(n => generateAgentConfig(provider, n)))

	return {
		goal,
		graph: { goal, nodes, edges },
		agents,
	}
}
