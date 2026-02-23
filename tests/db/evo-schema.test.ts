import { describe, it, expect } from 'vitest'
import {
	workflows,
	workflowNodes,
	workflowEdges,
} from '../../src/db/schema/workflows'
import { agentConfigs } from '../../src/db/schema/agent-configs'
import { promptVersions, promptGradients } from '../../src/db/schema/prompt-versions'
import { evolutionCycles, evolutionCandidates } from '../../src/db/schema/evolution-cycles'
import { hitlRequests } from '../../src/db/schema/hitl-requests'

describe('evo schemas', () => {
	it('workflows table has required columns', () => {
		expect(workflows.id).toBeDefined()
		expect(workflows.tenantId).toBeDefined()
		expect(workflows.goal).toBeDefined()
		expect(workflows.status).toBeDefined()
	})

	it('workflowNodes table has required columns', () => {
		expect(workflowNodes.id).toBeDefined()
		expect(workflowNodes.workflowId).toBeDefined()
		expect(workflowNodes.name).toBeDefined()
		expect(workflowNodes.status).toBeDefined()
		expect(workflowNodes.inputs).toBeDefined()
		expect(workflowNodes.outputs).toBeDefined()
	})

	it('workflowEdges table has required columns', () => {
		expect(workflowEdges.sourceNodeId).toBeDefined()
		expect(workflowEdges.targetNodeId).toBeDefined()
		expect(workflowEdges.priority).toBeDefined()
	})

	it('agentConfigs table has required columns', () => {
		expect(agentConfigs.id).toBeDefined()
		expect(agentConfigs.tenantId).toBeDefined()
		expect(agentConfigs.name).toBeDefined()
		expect(agentConfigs.systemPrompt).toBeDefined()
		expect(agentConfigs.instructionPrompt).toBeDefined()
	})

	it('promptVersions table has required columns', () => {
		expect(promptVersions.id).toBeDefined()
		expect(promptVersions.agentConfigId).toBeDefined()
		expect(promptVersions.version).toBeDefined()
		expect(promptVersions.systemPrompt).toBeDefined()
		expect(promptVersions.score).toBeDefined()
	})

	it('promptGradients table has required columns', () => {
		expect(promptGradients.id).toBeDefined()
		expect(promptGradients.promptVersionId).toBeDefined()
		expect(promptGradients.gradient).toBeDefined()
		expect(promptGradients.loss).toBeDefined()
	})

	it('evolutionCycles table has required columns', () => {
		expect(evolutionCycles.id).toBeDefined()
		expect(evolutionCycles.tenantId).toBeDefined()
		expect(evolutionCycles.generation).toBeDefined()
		expect(evolutionCycles.strategy).toBeDefined()
		expect(evolutionCycles.status).toBeDefined()
	})

	it('evolutionCandidates table has required columns', () => {
		expect(evolutionCandidates.id).toBeDefined()
		expect(evolutionCandidates.cycleId).toBeDefined()
		expect(evolutionCandidates.prompt).toBeDefined()
		expect(evolutionCandidates.score).toBeDefined()
	})

	it('hitlRequests table has required columns', () => {
		expect(hitlRequests.id).toBeDefined()
		expect(hitlRequests.tenantId).toBeDefined()
		expect(hitlRequests.workflowId).toBeDefined()
		expect(hitlRequests.nodeId).toBeDefined()
		expect(hitlRequests.decision).toBeDefined()
		expect(hitlRequests.expiresAt).toBeDefined()
	})
})
