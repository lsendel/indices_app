import { createApp } from '../../src/app'

export function getTestApp() {
	process.env.ENVIRONMENT = 'testing'
	process.env.DATABASE_URL = 'postgresql://test:test@localhost/commark_test'
	process.env.BETTER_AUTH_SECRET = 'test-secret'
	return createApp()
}
