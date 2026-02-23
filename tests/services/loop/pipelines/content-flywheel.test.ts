import { describe, it, expect, vi } from 'vitest'
import { createContentFlywheelHandler } from '../../../../src/services/loop/pipelines/content-flywheel'
import type { LoopEvent } from '../../../../src/services/loop'

describe('Content Flywheel Pipeline', () => {
	const mockEvent: LoopEvent = {
		id: 'e-1',
		tenantId: 'tenant-1',
		type: 'engagement.threshold_reached',
		payload: { channel: 'email', currentScore: 85, threshold: 100 },
		timestamp: new Date(),
	}

	it('should call learning iteration with correct context', async () => {
		const mockLearning = vi.fn().mockResolvedValue({
			evaluation: { combinedScore: 0.8 },
			candidatePrompts: ['Evolved prompt v2'],
		})

		const handler = createContentFlywheelHandler({
			runLearning: mockLearning,
			getActivePrompt: vi.fn().mockResolvedValue({ id: 'pv-1', systemPrompt: 'sys', instruction: 'instr' }),
			storeCandidate: vi.fn().mockResolvedValue('pv-2'),
		})

		await handler(mockEvent, {})

		expect(mockLearning).toHaveBeenCalledWith(
			expect.objectContaining({ channel: 'email' }),
		)
	})

	it('should store candidate prompt with lineage', async () => {
		const storeCandidate = vi.fn().mockResolvedValue('pv-2')

		const handler = createContentFlywheelHandler({
			runLearning: vi.fn().mockResolvedValue({
				evaluation: { combinedScore: 0.8 },
				candidatePrompts: ['New system prompt'],
			}),
			getActivePrompt: vi.fn().mockResolvedValue({ id: 'pv-1', systemPrompt: 'sys', instruction: 'instr', version: 1 }),
			storeCandidate,
		})

		await handler(mockEvent, {})

		expect(storeCandidate).toHaveBeenCalledWith(
			expect.objectContaining({
				tenantId: 'tenant-1',
				channel: 'email',
				parentId: 'pv-1',
			}),
		)
	})

	it('should respect strategy override from rules', async () => {
		const mockLearning = vi.fn().mockResolvedValue({
			evaluation: { combinedScore: 0.7 },
			candidatePrompts: ['prompt'],
		})

		const handler = createContentFlywheelHandler({
			runLearning: mockLearning,
			getActivePrompt: vi.fn().mockResolvedValue({ id: 'pv-1', systemPrompt: 'sys', instruction: 'instr' }),
			storeCandidate: vi.fn().mockResolvedValue('pv-2'),
		})

		await handler(mockEvent, { strategy: 'textgrad' })

		expect(mockLearning).toHaveBeenCalledWith(
			expect.objectContaining({ strategy: 'textgrad' }),
		)
	})
})
