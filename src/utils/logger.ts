import pino from 'pino'
import { getConfig } from '../config'

export function createLogger() {
	const config = getConfig()
	return pino({
		level: config.ENVIRONMENT === 'production' ? 'info' : 'debug',
		transport:
			config.ENVIRONMENT !== 'production'
				? { target: 'pino-pretty', options: { colorize: true } }
				: undefined,
	})
}

export const logger = createLogger()
