import type { ErrorHandler } from 'hono'
import { AppError } from '../types/errors'

export const errorHandler: ErrorHandler = (err, c) => {
	if (err instanceof AppError) {
		return c.json({ error: err.code, message: err.message }, err.statusCode as 400)
	}

	const isDev = (process.env.ENVIRONMENT || 'development') !== 'production'
	console.error('Unhandled error', err)
	return c.json(
		{
			error: 'INTERNAL_ERROR',
			message: isDev ? String(err) : 'An unexpected error occurred',
		},
		500,
	)
}
