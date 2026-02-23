import { describe, it, expect } from 'vitest'
import { getPlatformAdapter } from '../../../src/adapters/platforms'

describe('getPlatformAdapter factory', () => {
	it('should return adapter for each supported platform', () => {
		const platforms = ['instagram', 'facebook', 'whatsapp', 'tiktok', 'linkedin', 'wordpress', 'blog'] as const
		for (const platform of platforms) {
			const adapter = getPlatformAdapter(platform)
			expect(adapter.name).toBe(platform)
			expect(adapter.platform).toBe(platform)
		}
	})

	it('should throw for unsupported platform', () => {
		expect(() => getPlatformAdapter('myspace' as any)).toThrow('Unsupported platform: myspace')
	})

	it('should return adapters with publish and getEngagement methods', () => {
		const adapter = getPlatformAdapter('instagram')
		expect(typeof adapter.publish).toBe('function')
		expect(typeof adapter.getEngagement).toBe('function')
	})
})
