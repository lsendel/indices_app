import type { WorkFlowNode, WorkFlowEdge } from '../../types/workflow'

/** Infer edges by matching output parameter names to input parameter names across nodes. */
export function inferEdges(nodes: WorkFlowNode[]): WorkFlowEdge[] {
	const edges: WorkFlowEdge[] = []

	for (const source of nodes) {
		const outputNames = new Set(source.outputs.map(o => o.name))
		for (const target of nodes) {
			if (source.name === target.name) continue
			const hasMatch = target.inputs.some(i => outputNames.has(i.name))
			if (hasMatch) {
				edges.push({ source: source.name, target: target.name, priority: 0 })
			}
		}
	}

	return edges
}

/** Find pending nodes whose ALL predecessor nodes are completed. */
export function getNextNodes(nodes: WorkFlowNode[], edges: WorkFlowEdge[]): WorkFlowNode[] {
	const nodeMap = new Map(nodes.map(n => [n.name, n]))
	const incoming = new Map<string, string[]>()

	for (const node of nodes) {
		incoming.set(node.name, [])
	}
	for (const edge of edges) {
		incoming.get(edge.target)?.push(edge.source)
	}

	return nodes.filter(node => {
		if (node.status !== 'pending') return false
		const predecessors = incoming.get(node.name) ?? []
		return predecessors.every(pred => {
			const predNode = nodeMap.get(pred)
			return predNode?.status === 'completed'
		})
	})
}

/** Validate that the graph is a DAG (no cycles) and all edge references exist. */
export function validateGraph(
	nodes: WorkFlowNode[],
	edges: WorkFlowEdge[],
): { valid: boolean; error?: string } {
	const nodeNames = new Set<string>()
	for (const node of nodes) {
		if (nodeNames.has(node.name)) {
			return { valid: false, error: `Duplicate node name: ${node.name}` }
		}
		nodeNames.add(node.name)
	}

	for (const edge of edges) {
		if (!nodeNames.has(edge.source)) {
			return { valid: false, error: `Edge references non-existent node: ${edge.source}` }
		}
		if (!nodeNames.has(edge.target)) {
			return { valid: false, error: `Edge references non-existent node: ${edge.target}` }
		}
	}

	// Kahn's algorithm for cycle detection
	const inDegree = new Map<string, number>()
	const adjacency = new Map<string, string[]>()

	for (const name of nodeNames) {
		inDegree.set(name, 0)
		adjacency.set(name, [])
	}
	for (const edge of edges) {
		adjacency.get(edge.source)!.push(edge.target)
		inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1)
	}

	const queue = [...nodeNames].filter(n => inDegree.get(n) === 0)
	let visited = 0

	while (queue.length > 0) {
		const current = queue.shift()!
		visited++
		for (const neighbor of adjacency.get(current) ?? []) {
			const deg = inDegree.get(neighbor)! - 1
			inDegree.set(neighbor, deg)
			if (deg === 0) queue.push(neighbor)
		}
	}

	if (visited !== nodeNames.size) {
		return { valid: false, error: 'Graph contains a cycle' }
	}

	return { valid: true }
}

/** Return nodes in topological order (dependency-first). */
export function topologicalSort(nodes: WorkFlowNode[], edges: WorkFlowEdge[]): WorkFlowNode[] {
	const nodeMap = new Map(nodes.map(n => [n.name, n]))
	const inDegree = new Map<string, number>()
	const adjacency = new Map<string, string[]>()

	for (const node of nodes) {
		inDegree.set(node.name, 0)
		adjacency.set(node.name, [])
	}
	for (const edge of edges) {
		adjacency.get(edge.source)!.push(edge.target)
		inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1)
	}

	const queue = nodes.filter(n => inDegree.get(n.name) === 0).map(n => n.name)
	const result: WorkFlowNode[] = []

	while (queue.length > 0) {
		const current = queue.shift()!
		result.push(nodeMap.get(current)!)
		for (const neighbor of adjacency.get(current) ?? []) {
			const deg = inDegree.get(neighbor)! - 1
			inDegree.set(neighbor, deg)
			if (deg === 0) queue.push(neighbor)
		}
	}

	return result
}
