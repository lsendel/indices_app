import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		exclude: [
			'**/node_modules/**',
			'**/.claude/worktrees/**',
			'**/.worktrees/**',
		],
		setupFiles: ['./tests/setup.ts'],
	},
})
