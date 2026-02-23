import { describe, it, expect } from 'vitest'
import { loopPromptVersions } from '../../src/db/schema/loop-prompt-versions'
import { contentLineage } from '../../src/db/schema/content-lineage'

describe('lineage schema', () => {
	it('loopPromptVersions has required columns', () => {
		expect(loopPromptVersions.id).toBeDefined()
		expect(loopPromptVersions.tenantId).toBeDefined()
		expect(loopPromptVersions.channel).toBeDefined()
		expect(loopPromptVersions.systemPrompt).toBeDefined()
		expect(loopPromptVersions.instruction).toBeDefined()
		expect(loopPromptVersions.version).toBeDefined()
		expect(loopPromptVersions.parentId).toBeDefined()
		expect(loopPromptVersions.status).toBeDefined()
	})

	it('contentLineage has required columns', () => {
		expect(contentLineage.id).toBeDefined()
		expect(contentLineage.tenantId).toBeDefined()
		expect(contentLineage.promptVersionId).toBeDefined()
		expect(contentLineage.channel).toBeDefined()
		expect(contentLineage.engagementScore).toBeDefined()
	})
})
