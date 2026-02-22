import { ValidationError } from '../../types/errors'

export type HitlDecisionType = 'pending' | 'approved' | 'rejected' | 'modified'

export interface HitlRequest {
	tenantId: string
	workflowId: string
	nodeId: string
	decision: HitlDecisionType
	context: Record<string, unknown>
	modifications?: Record<string, unknown>
	decidedBy?: string
	expiresAt: Date
	decidedAt?: Date
	createdAt: Date
}

interface CreateHitlInput {
	tenantId: string
	workflowId: string
	nodeId: string
	context: Record<string, unknown>
	expiryHours?: number
}

const DEFAULT_EXPIRY_HOURS = 24

export function createHitlRequest(input: CreateHitlInput): HitlRequest {
	const hours = input.expiryHours ?? DEFAULT_EXPIRY_HOURS
	return {
		tenantId: input.tenantId,
		workflowId: input.workflowId,
		nodeId: input.nodeId,
		decision: 'pending',
		context: input.context,
		expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
		createdAt: new Date(),
	}
}

export function resolveHitlRequest(
	request: HitlRequest,
	decision: HitlDecisionType,
	decidedBy: string,
	modifications?: Record<string, unknown>,
): HitlRequest {
	if (request.decision !== 'pending') {
		throw new ValidationError(`HITL request is not pending (current: ${request.decision})`)
	}

	return {
		...request,
		decision,
		decidedBy,
		modifications,
		decidedAt: new Date(),
	}
}

export function isExpired(request: HitlRequest): boolean {
	return request.expiresAt.getTime() < Date.now()
}
