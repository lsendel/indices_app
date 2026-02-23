import { vi } from 'vitest'

// Global mock for logger — prevents transitive getConfig() calls from failing
// when test files don't have DATABASE_URL set.
vi.mock('../src/utils/logger', () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
		child: vi.fn().mockReturnValue({
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			debug: vi.fn(),
		}),
	},
}))
