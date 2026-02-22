import { describe, it, expect } from 'vitest'
import {
	createHitlRequest,
	resolveHitlRequest,
	isExpired,
	type HitlRequest,
	type HitlDecisionType,
} from '../../../src/services/evo/hitl'

describe('HITL service', () => {
	it('creates a HITL request with default 24h expiry', () => {
		const req = createHitlRequest({
			tenantId: 't1',
			workflowId: 'w1',
			nodeId: 'n1',
			context: { content: 'Draft email for review' },
		})
		expect(req.decision).toBe('pending')
		expect(req.expiresAt.getTime()).toBeGreaterThan(Date.now())
	})

	it('creates a request with custom expiry', () => {
		const req = createHitlRequest({
			tenantId: 't1',
			workflowId: 'w1',
			nodeId: 'n1',
			context: {},
			expiryHours: 1,
		})
		const diff = req.expiresAt.getTime() - Date.now()
		expect(diff).toBeLessThanOrEqual(1 * 60 * 60 * 1000 + 1000)
		expect(diff).toBeGreaterThan(0)
	})

	it('resolves a pending request with approved', () => {
		const req = createHitlRequest({
			tenantId: 't1',
			workflowId: 'w1',
			nodeId: 'n1',
			context: {},
		})
		const resolved = resolveHitlRequest(req, 'approved', 'user-1')
		expect(resolved.decision).toBe('approved')
		expect(resolved.decidedBy).toBe('user-1')
		expect(resolved.decidedAt).toBeDefined()
	})

	it('resolves with modifications', () => {
		const req = createHitlRequest({
			tenantId: 't1',
			workflowId: 'w1',
			nodeId: 'n1',
			context: {},
		})
		const resolved = resolveHitlRequest(req, 'modified', 'user-1', { prompt: 'Updated' })
		expect(resolved.decision).toBe('modified')
		expect(resolved.modifications).toEqual({ prompt: 'Updated' })
	})

	it('throws if resolving a non-pending request', () => {
		const req = createHitlRequest({
			tenantId: 't1',
			workflowId: 'w1',
			nodeId: 'n1',
			context: {},
		})
		const resolved = resolveHitlRequest(req, 'approved', 'user-1')
		expect(() => resolveHitlRequest(resolved, 'rejected', 'user-2')).toThrow('not pending')
	})

	it('detects expired requests', () => {
		const req = createHitlRequest({
			tenantId: 't1',
			workflowId: 'w1',
			nodeId: 'n1',
			context: {},
		})
		expect(isExpired(req)).toBe(false)

		const expired: HitlRequest = {
			...req,
			expiresAt: new Date(Date.now() - 1000),
		}
		expect(isExpired(expired)).toBe(true)
	})

	it('throws when resolving an expired request', () => {
		const req = createHitlRequest({
			tenantId: 't1',
			workflowId: 'w1',
			nodeId: 'n1',
			context: {},
		})
		const expired: HitlRequest = {
			...req,
			expiresAt: new Date(Date.now() - 1000),
		}
		expect(() => resolveHitlRequest(expired, 'approved', 'user-1')).toThrow('expired')
	})
})
