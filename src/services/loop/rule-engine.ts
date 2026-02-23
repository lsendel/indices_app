export interface Condition {
	field: string
	op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'contains' | 'between' | 'in_group' | 'not_in_group'
	value: unknown
}

export interface Action {
	type: 'gate' | 'modify' | 'route' | 'notify' | 'generate'
	set?: Record<string, unknown>
	message?: string
	pipeline?: string
	channels?: string[]
	goal?: string
	tone?: string
}

export interface Rule {
	id: string
	name: string
	priority: number
	cooldownMinutes: number
	conditions: Condition[]
	actions: Action[]
	scope: Record<string, unknown>
	lastFiredAt?: Date
}

export interface RuleEvaluation {
	matched: Rule[]
	gated: boolean
	configOverrides: Record<string, unknown>
	notifications: Action[]
	routes: Action[]
	generates: Action[]
}

interface EvalContext {
	groups?: Record<string, string[]>
	[key: string]: unknown
}

function resolveField(field: string, payload: Record<string, unknown>, context: EvalContext): unknown {
	if (field in payload) return payload[field]
	const parts = field.split('.')
	let current: unknown = { ...payload, ...context }
	for (const part of parts) {
		if (current == null || typeof current !== 'object') return undefined
		current = (current as Record<string, unknown>)[part]
	}
	return current
}

function evaluateCondition(condition: Condition, payload: Record<string, unknown>, context: EvalContext): boolean {
	const { field, op, value } = condition

	if (op === 'in_group') {
		const channel = payload.channel as string
		const groups = context.groups ?? {}
		const members = groups[value as string] ?? []
		return members.includes(channel)
	}

	if (op === 'not_in_group') {
		const channel = payload.channel as string
		const groups = context.groups ?? {}
		const members = groups[value as string] ?? []
		return !members.includes(channel)
	}

	const resolved = resolveField(field, payload, context)

	switch (op) {
		case 'eq': return resolved === value
		case 'neq': return resolved !== value
		case 'gt': return (resolved as number) > (value as number)
		case 'gte': return (resolved as number) >= (value as number)
		case 'lt': return (resolved as number) < (value as number)
		case 'lte': return (resolved as number) <= (value as number)
		case 'in': return Array.isArray(value) && value.includes(resolved)
		case 'not_in': return Array.isArray(value) && !value.includes(resolved)
		case 'contains': {
			if (typeof resolved === 'string') return resolved.includes(value as string)
			if (Array.isArray(resolved)) return resolved.includes(value)
			return false
		}
		case 'between': {
			const [min, max] = value as [number, number]
			return (resolved as number) >= min && (resolved as number) <= max
		}
		default: return false
	}
}

export function evaluateRules(
	rules: Rule[],
	payload: Record<string, unknown>,
	context: EvalContext,
): RuleEvaluation {
	const sorted = [...rules].sort((a, b) => a.priority - b.priority)

	const result: RuleEvaluation = {
		matched: [],
		gated: false,
		configOverrides: {},
		notifications: [],
		routes: [],
		generates: [],
	}

	for (const rule of sorted) {
		if (rule.cooldownMinutes > 0 && rule.lastFiredAt) {
			const cooldownMs = rule.cooldownMinutes * 60_000
			if (Date.now() - rule.lastFiredAt.getTime() < cooldownMs) continue
		}

		const allMatch = rule.conditions.every((c) => evaluateCondition(c, payload, context))
		if (!allMatch) continue

		result.matched.push(rule)

		for (const action of rule.actions) {
			switch (action.type) {
				case 'gate':
					result.gated = true
					return result
				case 'modify':
					Object.assign(result.configOverrides, action.set ?? {})
					break
				case 'notify':
					result.notifications.push(action)
					break
				case 'route':
					result.routes.push(action)
					break
				case 'generate':
					result.generates.push(action)
					break
			}
		}
	}

	return result
}
