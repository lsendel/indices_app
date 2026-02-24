import { createApp } from './app'

const app = createApp()

// CF Workers export (default) — also works as Bun's export default { fetch }
export default app

// Bun-only: log startup info when running under Bun runtime
if (typeof (globalThis as Record<string, unknown>).Bun !== 'undefined') {
	const port = parseInt(process.env.PORT || '3001', 10)
	console.log(`Starting indices-api on port ${port} (Bun)`)
}
