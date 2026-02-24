export interface Logger {
	info(message: string, data?: Record<string, unknown>): void
	error(message: string, data?: Record<string, unknown>): void
	warn(message: string, data?: Record<string, unknown>): void
	debug(message: string, data?: Record<string, unknown>): void
}

export function createLogger(context?: Record<string, unknown>): Logger {
	const base = context ?? {}
	return {
		info: (msg, data) => console.log(JSON.stringify({ level: 'info', msg, ...base, ...data })),
		error: (msg, data) => console.error(JSON.stringify({ level: 'error', msg, ...base, ...data })),
		warn: (msg, data) => console.warn(JSON.stringify({ level: 'warn', msg, ...base, ...data })),
		debug: (msg, data) => console.debug(JSON.stringify({ level: 'debug', msg, ...base, ...data })),
	}
}

export const logger = createLogger()
