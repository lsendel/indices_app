import { z } from 'zod'

export const configSchema = z.object({
	ENVIRONMENT: z.enum(['development', 'staging', 'production', 'testing']).default('development'),
	PORT: z.coerce.number().default(3001),
	DATABASE_URL: z.string().min(1),
	BETTER_AUTH_SECRET: z.string().min(1).default('dev-secret-change-in-production'),
	BETTER_AUTH_URL: z.string().url().default('http://localhost:3001'),
	OPENAI_API_KEY: z.string().optional(),
	OPENAI_MODEL: z.string().default('gpt-4o'),
	SENDGRID_API_KEY: z.string().optional(),
	TWILIO_ACCOUNT_SID: z.string().optional(),
	TWILIO_AUTH_TOKEN: z.string().optional(),
	TWILIO_FROM_NUMBER: z.string().optional(),
	SCRAPER_WORKER_URL: z.string().url().default('http://localhost:8080'),
	SCRAPER_SHARED_SECRET: z.string().default('dev-secret'),
	ZELUTO_API_URL: z.string().url().default('https://zeluto.com/api/v1'),
	ZELUTO_TENANT_CONTEXT: z.string().optional(),
	ZELUTO_API_KEY: z.string().optional(),
	ZELUTO_WEBHOOK_SECRET: z.string().default('dev-webhook-secret'),
	CORS_ORIGINS: z.string().default('http://localhost:3000'),
	REDIS_URL: z.string().optional(),
	META_APP_ID: z.string().optional(),
	META_APP_SECRET: z.string().optional(),
	TIKTOK_CLIENT_KEY: z.string().optional(),
	TIKTOK_CLIENT_SECRET: z.string().optional(),
	LINKEDIN_CLIENT_ID: z.string().optional(),
	LINKEDIN_CLIENT_SECRET: z.string().optional(),
})

export type Config = z.infer<typeof configSchema>

let _config: Config | null = null

export function getConfig(): Config {
	if (!_config) {
		_config = configSchema.parse(process.env)
	}
	return _config
}
