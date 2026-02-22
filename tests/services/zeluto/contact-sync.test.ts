import { describe, it, expect, vi } from 'vitest'
import {
	syncContacts,
	mapProspectToZelutoContact,
} from '../../../src/services/zeluto/contact-sync'

describe('contact sync', () => {
	describe('mapProspectToZelutoContact', () => {
		it('maps prospect fields to zeluto contact fields', () => {
			const result = mapProspectToZelutoContact({
				name: 'Jane Smith',
				email: 'jane@acme.com',
				phone: '+15551234567',
				company: 'Acme Inc',
				role: 'CTO',
			})

			expect(result.email).toBe('jane@acme.com')
			expect(result.firstName).toBe('Jane')
			expect(result.lastName).toBe('Smith')
			expect(result.phone).toBe('+15551234567')
			expect(result.customFields).toEqual({ company: 'Acme Inc', role: 'CTO' })
		})

		it('handles single-word names', () => {
			const result = mapProspectToZelutoContact({
				name: 'Madonna',
				company: 'Music',
				role: 'Artist',
			})
			expect(result.firstName).toBe('Madonna')
			expect(result.lastName).toBeUndefined()
		})
	})

	describe('syncContacts', () => {
		it('imports contacts via client and returns result', async () => {
			const mockClient = {
				importContacts: vi.fn().mockResolvedValue({
					imported: 3,
					failed: 0,
					errors: [],
				}),
			}

			const prospects = [
				{ name: 'Alice B', email: 'alice@co.com', company: 'Co', role: 'Dev' },
				{ name: 'Bob C', email: 'bob@co.com', company: 'Co', role: 'PM' },
				{ name: 'Charlie D', email: 'charlie@co.com', company: 'Co', role: 'CEO' },
			]

			const result = await syncContacts(mockClient as any, prospects)

			expect(result.imported).toBe(3)
			expect(result.failed).toBe(0)
			expect(mockClient.importContacts).toHaveBeenCalledTimes(1)
			const sentContacts = mockClient.importContacts.mock.calls[0][0]
			expect(sentContacts).toHaveLength(3)
			expect(sentContacts[0].firstName).toBe('Alice')
			expect(sentContacts[0].lastName).toBe('B')
		})

		it('batches contacts in groups of 100', async () => {
			const mockClient = {
				importContacts: vi
					.fn()
					.mockResolvedValue({ imported: 100, failed: 0, errors: [] }),
			}

			const prospects = Array.from({ length: 150 }, (_, i) => ({
				name: `User ${i}`,
				email: `user${i}@co.com`,
				company: 'Co',
				role: 'Dev',
			}))

			const result = await syncContacts(mockClient as any, prospects)

			expect(mockClient.importContacts).toHaveBeenCalledTimes(2)
			expect(result.imported).toBe(200)
		})
	})
})
