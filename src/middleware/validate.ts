import { zValidator } from '@hono/zod-validator'
import type { z } from 'zod'
import type { ValidationTargets } from 'hono'

export function validate<Target extends keyof ValidationTargets, Schema extends z.ZodSchema>(
	target: Target,
	schema: Schema,
) {
	return zValidator(target, schema, (result, c) => {
		if (!result.success) {
			return c.json(
				{ error: 'VALIDATION_ERROR', issues: result.error.issues },
				422,
			)
		}
	})
}
