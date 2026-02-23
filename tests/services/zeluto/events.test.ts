import { describe, it, expect } from 'vitest'
import { classifyDeliveryEvent, isEngagementEvent } from '../../../src/services/zeluto/events'

describe('event processing', () => {
	describe('classifyDeliveryEvent', () => {
		it('classifies opened as positive engagement', () => {
			expect(classifyDeliveryEvent('opened')).toBe('engagement')
		})

		it('classifies clicked as positive engagement', () => {
			expect(classifyDeliveryEvent('clicked')).toBe('engagement')
		})

		it('classifies bounced as negative', () => {
			expect(classifyDeliveryEvent('bounced')).toBe('negative')
		})

		it('classifies complained as negative', () => {
			expect(classifyDeliveryEvent('complained')).toBe('negative')
		})

		it('classifies delivered as neutral', () => {
			expect(classifyDeliveryEvent('delivered')).toBe('neutral')
		})

		it('classifies sent as neutral', () => {
			expect(classifyDeliveryEvent('sent')).toBe('neutral')
		})
	})

	describe('isEngagementEvent', () => {
		it('returns true for opened/clicked', () => {
			expect(isEngagementEvent('opened')).toBe(true)
			expect(isEngagementEvent('clicked')).toBe(true)
		})

		it('returns false for sent/delivered/bounced', () => {
			expect(isEngagementEvent('sent')).toBe(false)
			expect(isEngagementEvent('delivered')).toBe(false)
			expect(isEngagementEvent('bounced')).toBe(false)
		})
	})
})
