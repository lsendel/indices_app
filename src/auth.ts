import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import type { Database } from './db/client'
import type { Bindings } from './app'
import * as authSchema from './db/schema/auth'

export function createAuth(db: Database, env: Bindings, baseURL?: string) {
	return betterAuth({
		baseURL: baseURL || env.BETTER_AUTH_URL,
		secret: env.BETTER_AUTH_SECRET,
		trustedOrigins: [env.BETTER_AUTH_URL, env.CORS_ORIGINS || 'https://indices.app'],
		database: drizzleAdapter(db, {
			provider: 'pg',
			schema: authSchema,
		}),
		emailAndPassword: {
			enabled: true,
		},
		account: {
			accountLinking: {
				enabled: true,
				trustedProviders: ['google'],
			},
		},
		socialProviders: {
			google: {
				clientId: env.GOOGLE_CLIENT_ID!,
				clientSecret: env.GOOGLE_CLIENT_SECRET!,
			},
		},
	})
}
