import { describe, it, expect } from 'vitest'
import { evaluateRules, type Rule, type RuleEvaluation } from '../../../src/services/loop/rule-engine'

const baseEvent = {
	tenantId: 'tenant-1',
	type: 'engagement.collected' as const,
	payload: { channel: 'email', score: 42, delta: 0.2 },
}

describe('Rule Engine', () => {
	it('should match eq condition', () => {
		const rule: Rule = {
			id: 'r1', name: 'test', priority: 10, cooldownMinutes: 0,
			conditions: [{ field: 'channel', op: 'eq', value: 'email' }],
			actions: [{ type: 'notify', message: 'matched' }],
			scope: {},
		}
		const result = evaluateRules([rule], baseEvent.payload, {})
		expect(result.matched).toHaveLength(1)
		expect(result.gated).toBe(false)
	})

	it('should match gt condition', () => {
		const rule: Rule = {
			id: 'r1', name: 'test', priority: 10, cooldownMinutes: 0,
			conditions: [{ field: 'score', op: 'gt', value: 40 }],
			actions: [{ type: 'modify', set: { strategy: 'textgrad' } }],
			scope: {},
		}
		const result = evaluateRules([rule], baseEvent.payload, {})
		expect(result.matched).toHaveLength(1)
	})

	it('should NOT match when condition fails', () => {
		const rule: Rule = {
			id: 'r1', name: 'test', priority: 10, cooldownMinutes: 0,
			conditions: [{ field: 'channel', op: 'eq', value: 'sms' }],
			actions: [{ type: 'notify', message: 'no match' }],
			scope: {},
		}
		const result = evaluateRules([rule], baseEvent.payload, {})
		expect(result.matched).toHaveLength(0)
	})

	it('should gate pipeline when gate action matches', () => {
		const rule: Rule = {
			id: 'r1', name: 'gate-email', priority: 1, cooldownMinutes: 0,
			conditions: [{ field: 'channel', op: 'eq', value: 'email' }],
			actions: [{ type: 'gate' }],
			scope: {},
		}
		const result = evaluateRules([rule], baseEvent.payload, {})
		expect(result.gated).toBe(true)
	})

	it('should merge modify actions', () => {
		const rules: Rule[] = [
			{
				id: 'r1', name: 'a', priority: 10, cooldownMinutes: 0,
				conditions: [{ field: 'channel', op: 'eq', value: 'email' }],
				actions: [{ type: 'modify', set: { strategy: 'textgrad' } }],
				scope: {},
			},
			{
				id: 'r2', name: 'b', priority: 20, cooldownMinutes: 0,
				conditions: [{ field: 'score', op: 'gt', value: 30 }],
				actions: [{ type: 'modify', set: { cadence_min: 120 } }],
				scope: {},
			},
		]
		const result = evaluateRules(rules, baseEvent.payload, {})
		expect(result.configOverrides).toEqual({ strategy: 'textgrad', cadence_min: 120 })
	})

	it('should support in_group operator', () => {
		const rule: Rule = {
			id: 'r1', name: 'test', priority: 10, cooldownMinutes: 0,
			conditions: [{ field: 'channel', op: 'in_group', value: 'high-performers' }],
			actions: [{ type: 'notify', message: 'in group' }],
			scope: {},
		}
		const context = { groups: { 'high-performers': ['email', 'linkedin'] } }
		const result = evaluateRules([rule], baseEvent.payload, context)
		expect(result.matched).toHaveLength(1)
	})

	it('should evaluate rules in priority order', () => {
		const rules: Rule[] = [
			{
				id: 'r2', name: 'low-priority', priority: 50, cooldownMinutes: 0,
				conditions: [{ field: 'channel', op: 'eq', value: 'email' }],
				actions: [{ type: 'modify', set: { strategy: 'ga' } }],
				scope: {},
			},
			{
				id: 'r1', name: 'high-priority', priority: 1, cooldownMinutes: 0,
				conditions: [{ field: 'channel', op: 'eq', value: 'email' }],
				actions: [{ type: 'gate' }],
				scope: {},
			},
		]
		const result = evaluateRules(rules, baseEvent.payload, {})
		expect(result.gated).toBe(true)
		expect(result.configOverrides).toEqual({})
	})
})
