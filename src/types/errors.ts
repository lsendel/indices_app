export class AppError extends Error {
	constructor(
		public statusCode: number,
		message: string,
		public code: string = 'INTERNAL_ERROR',
	) {
		super(message)
		this.name = 'AppError'
	}
}

export class NotFoundError extends AppError {
	constructor(resource: string, id: string) {
		super(404, `${resource} with id ${id} not found`, 'NOT_FOUND')
	}
}

export class ConflictError extends AppError {
	constructor(message: string) {
		super(409, message, 'CONFLICT')
	}
}

export class UnauthorizedError extends AppError {
	constructor(message = 'Authentication required') {
		super(401, message, 'UNAUTHORIZED')
	}
}

export class ForbiddenError extends AppError {
	constructor(message = 'Insufficient permissions') {
		super(403, message, 'FORBIDDEN')
	}
}

export class ValidationError extends AppError {
	constructor(message: string) {
		super(422, message, 'VALIDATION_ERROR')
	}
}
