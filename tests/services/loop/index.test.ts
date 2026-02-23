import { describe, it, expect } from 'vitest'
import { createEventBus, createPipelineExecutor, evaluateRules, getDefaultGroups } from '../../../src/services/loop'

describe('loop barrel exports', () => {
	it('exports all core components', () => {
		expect(createEventBus).toBeTypeOf('function')
		expect(createPipelineExecutor).toBeTypeOf('function')
		expect(evaluateRules).toBeTypeOf('function')
		expect(getDefaultGroups).toBeTypeOf('function')
	})
})
