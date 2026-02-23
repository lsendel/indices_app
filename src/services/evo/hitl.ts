import { ValidationError } from '../../types/errors'

export type HitlDecisionType = 'pending' | 'approved' | 'rejected' | 'modified'
export type HitlResolution = 'approved' | 'rejected' | 'modified'

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

/**
 * Create a new HITL request in the pending state.
 * @param input - Tenant, workflow, node, context, and optional expiry hours
 * @returns New HITL request with calculated expiry timestamp
 */
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

/**
 * Resolve a pending HITL request with a decision.
 * @param request - HITL request to resolve (must be pending and not expired)
 * @param decision - Resolution decision (approved, rejected, or modified)
 * @param decidedBy - User ID of the decision maker
 * @param modifications - Optional modifications when decision is 'modified'
 * @returns New HITL request object with the resolution applied
 * @throws ValidationError if request is not pending or has expired
 */
export function resolveHitlRequest(
	request: HitlRequest,
	decision: HitlResolution,
	decidedBy: string,
	modifications?: Record<string, unknown>,
): HitlRequest {
	if (request.decision !== 'pending') {
		throw new ValidationError(`HITL request is not pending (current: ${request.decision})`)
	}
	if (isExpired(request)) {
		throw new ValidationError('HITL request has expired')
	}

	return {
		...request,
		decision,
		decidedBy,
		modifications,
		decidedAt: new Date(),
	}
}

/**
 * Check whether a HITL request has passed its expiry timestamp.
 * @param request - HITL request to check
 * @returns true if the request has expired
 */
export function isExpired(request: HitlRequest): boolean {
	return request.expiresAt.getTime() < Date.now()
}
