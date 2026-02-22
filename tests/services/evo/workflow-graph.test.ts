import { describe, it, expect } from 'vitest'
import { inferEdges, getNextNodes, validateGraph, topologicalSort } from '../../../src/services/evo/workflow-graph'
import type { WorkFlowNode, WorkFlowEdge } from '../../../src/types/workflow'

const makeNode = (name: string, inputs: string[], outputs: string[], status = 'pending' as const): WorkFlowNode => ({
	name,
	description: `${name} task`,
	inputs: inputs.map(n => ({ name: n, description: n, required: true })),
	outputs: outputs.map(n => ({ name: n, description: n, required: true })),
	status,
	agentId: null,
})

describe('inferEdges', () => {
	it('infers edges from matching output→input parameter names', () => {
		const nodes = [
			makeNode('research', [], ['insights']),
			makeNode('draft', ['insights'], ['email_body']),
			makeNode('review', ['email_body'], ['approved_body']),
		]
		const edges = inferEdges(nodes)
		expect(edges).toHaveLength(2)
		expect(edges[0]).toEqual({ source: 'research', target: 'draft', priority: 0 })
		expect(edges[1]).toEqual({ source: 'draft', target: 'review', priority: 0 })
	})

	it('returns empty edges when no parameters match', () => {
		const nodes = [
			makeNode('a', [], ['x']),
			makeNode('b', ['y'], []),
		]
		expect(inferEdges(nodes)).toHaveLength(0)
	})

	it('handles multi-input nodes', () => {
		const nodes = [
			makeNode('research', [], ['insights']),
			makeNode('persona', [], ['tone']),
			makeNode('draft', ['insights', 'tone'], ['email_body']),
		]
		const edges = inferEdges(nodes)
		expect(edges).toHaveLength(2)
	})
})

describe('getNextNodes', () => {
	it('returns nodes with all predecessors completed', () => {
		const nodes = [
			makeNode('a', [], ['x'], 'completed'),
			makeNode('b', ['x'], ['y'], 'pending'),
			makeNode('c', ['y'], [], 'pending'),
		]
		const edges: WorkFlowEdge[] = [
			{ source: 'a', target: 'b', priority: 0 },
			{ source: 'b', target: 'c', priority: 0 },
		]
		const next = getNextNodes(nodes, edges)
		expect(next.map(n => n.name)).toEqual(['b'])
	})

	it('returns root nodes when nothing is completed', () => {
		const nodes = [
			makeNode('a', [], ['x']),
			makeNode('b', ['x'], []),
		]
		const edges: WorkFlowEdge[] = [
			{ source: 'a', target: 'b', priority: 0 },
		]
		const next = getNextNodes(nodes, edges)
		expect(next.map(n => n.name)).toEqual(['a'])
	})

	it('returns multiple ready nodes for parallel execution', () => {
		const nodes = [
			makeNode('root', [], ['x'], 'completed'),
			makeNode('a', ['x'], [], 'pending'),
			makeNode('b', ['x'], [], 'pending'),
		]
		const edges: WorkFlowEdge[] = [
			{ source: 'root', target: 'a', priority: 0 },
			{ source: 'root', target: 'b', priority: 0 },
		]
		const next = getNextNodes(nodes, edges)
		expect(next).toHaveLength(2)
	})

	it('skips nodes that are already running or completed', () => {
		const nodes = [
			makeNode('a', [], ['x'], 'completed'),
			makeNode('b', ['x'], [], 'running'),
		]
		const edges: WorkFlowEdge[] = [
			{ source: 'a', target: 'b', priority: 0 },
		]
		expect(getNextNodes(nodes, edges)).toHaveLength(0)
	})
})

describe('validateGraph', () => {
	it('detects cycles', () => {
		const nodes = [
			makeNode('a', ['y'], ['x']),
			makeNode('b', ['x'], ['y']),
		]
		const edges: WorkFlowEdge[] = [
			{ source: 'a', target: 'b', priority: 0 },
			{ source: 'b', target: 'a', priority: 0 },
		]
		const result = validateGraph(nodes, edges)
		expect(result.valid).toBe(false)
		expect(result.error).toContain('cycle')
	})

	it('passes for a valid DAG', () => {
		const nodes = [
			makeNode('a', [], ['x']),
			makeNode('b', ['x'], ['y']),
			makeNode('c', ['y'], []),
		]
		const edges: WorkFlowEdge[] = [
			{ source: 'a', target: 'b', priority: 0 },
			{ source: 'b', target: 'c', priority: 0 },
		]
		expect(validateGraph(nodes, edges).valid).toBe(true)
	})

	it('detects references to non-existent nodes in edges', () => {
		const nodes = [makeNode('a', [], ['x'])]
		const edges: WorkFlowEdge[] = [
			{ source: 'a', target: 'ghost', priority: 0 },
		]
		const result = validateGraph(nodes, edges)
		expect(result.valid).toBe(false)
		expect(result.error).toContain('ghost')
	})

	it('detects duplicate node names', () => {
		const nodes = [
			makeNode('a', [], ['x']),
			makeNode('a', ['x'], ['y']),
		]
		const result = validateGraph(nodes, [])
		expect(result.valid).toBe(false)
		expect(result.error).toContain('Duplicate node name: a')
	})
})

describe('topologicalSort', () => {
	it('returns nodes in dependency order', () => {
		const nodes = [
			makeNode('c', ['y'], []),
			makeNode('a', [], ['x']),
			makeNode('b', ['x'], ['y']),
		]
		const edges: WorkFlowEdge[] = [
			{ source: 'a', target: 'b', priority: 0 },
			{ source: 'b', target: 'c', priority: 0 },
		]
		const sorted = topologicalSort(nodes, edges)
		expect(sorted.map(n => n.name)).toEqual(['a', 'b', 'c'])
	})
})
