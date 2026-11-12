import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/app'
import { createCampaignRoutes } from '../../src/routes/campaigns'
import { createZelutoPullRoutes } from '../../src/routes/zeluto-pull'
import { computeContentHash } from '../../src/services/campaigns/creative'
import { getMcpToolNames } from '../../src/mcp/server'
import { errorHandler } from '../../src/middleware/error-handler'

const creative = {
	brandKey: 'families.care',
	subject: 'Hello',
	previewText: null,
	bodyHtml: null,
	bodyText: 'Body',
	audienceSpec: { source: 'wave1', rules: {}, exclusions: [] },
}

// Minimal drizzle-like fake: select().from().where() resolves rows; update().set().where().returning()
function makeDb(row: Record<string, unknown> | null) {
	const state = { row, lastSet: null as Record<string, unknown> | null }
	const db = {
		select: () => ({ from: () => ({ where: () => Promise.resolve(state.row ? [state.row] : []) }) }),
		update: () => ({
			set: (v: Record<string, unknown>) => {
				state.lastSet = v
				return { where: () => ({ returning: () => Promise.resolve(state.row ? [{ ...state.row, ...v }] : []) }) }
			},
		}),
	}
	return { db, state }
}

function build(db: unknown, userId: string, env: Record<string, string | undefined>) {
	const app = new Hono<AppEnv>()
	app.onError(errorHandler)
	app.use('*', async (c, next) => {
		c.set('tenantId', 't1')
		c.set('userId', userId)
		c.set('db', db as any)
		;(c as any).env = env
		await next()
	})
	app.route('/campaigns', createCampaignRoutes())
	return app
}

describe('campaign approval routes', () => {
	let row: Record<string, unknown>
	beforeEach(async () => {
		row = { id: 'c1', tenantId: 't1', name: 'N', goal: 'G', ...creative, approvalStatus: 'draft', contentHash: await computeContentHash(creative) }
	})

	it('non-approver cannot approve', async () => {
		const { db } = makeDb(row)
		const res = await build(db, 'agent_user', { APPROVER_USER_IDS: 'luis' }).request('/campaigns/c1/approve', { method: 'POST', body: '{}' })
		expect(res.status).toBe(403)
	})

	it('approval fails closed when no allowlist is configured', async () => {
		const { db } = makeDb(row)
		const res = await build(db, 'luis', {}).request('/campaigns/c1/approve', { method: 'POST', body: '{}' })
		expect(res.status).toBe(403)
	})

	it('approver must present the current content hash', async () => {
		const { db } = makeDb(row)
		const app = build(db, 'luis', { APPROVER_USER_IDS: 'luis' })
		const bad = await app.request('/campaigns/c1/approve', { method: 'POST', body: JSON.stringify({ contentHash: 'stale' }) })
		expect(bad.status).toBe(409)
		const ok = await app.request('/campaigns/c1/approve', { method: 'POST', body: JSON.stringify({ contentHash: row.contentHash }) })
		expect(ok.status).toBe(200)
		const body = await ok.json()
		expect(body.approvalStatus).toBe('approved')
		expect(body.approvedBy).toBe('luis')
		expect(body.approvedHash).toBe(row.contentHash)
	})

	it('approval is refused while blockers exist', async () => {
		row.bodyText = 'x [POSTAL ADDRESS PENDING]'
		const { db } = makeDb(row)
		const res = await build(db, 'luis', { APPROVER_USER_IDS: 'luis' }).request('/campaigns/c1/approve', { method: 'POST', body: JSON.stringify({ contentHash: 'x' }) })
		expect(res.status).toBe(422)
	})

	it('editing creative resets approval', async () => {
		row.approvalStatus = 'approved'
		row.approvedBy = 'luis'
		const { db, state } = makeDb(row)
		const res = await build(db, 'agent_user', {}).request('/campaigns/c1/creative', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ brandKey: 'families.care', subject: 'Changed', bodyText: 'New body', audienceSpec: creative.audienceSpec }),
		})
		expect(res.status).toBe(200)
		expect(state.lastSet).toMatchObject({ approvalStatus: 'draft', approvedBy: null, approvedAt: null, approvedHash: null })
	})

	it('there is no MCP tool that approves', () => {
		const names = getMcpToolNames()
		expect(names).toContain('create_campaign_draft')
		expect(names.filter((n) => /approve|send|schedule/.test(n))).toEqual([])
	})
})

describe('zeluto pull routes', () => {
	function pullApp(db: unknown, env: Record<string, string | undefined>) {
		const app = new Hono<AppEnv>()
		app.onError(errorHandler)
		app.use('*', async (c, next) => { c.set('db', db as any); (c as any).env = env; await next() })
		app.route('/integrations/zeluto', createZelutoPullRoutes())
		return app
	}
	const env = { ZELUTO_PULL_TOKEN: 'secret-token', ZELUTO_PULL_TENANT_ID: 't1' }

	it('rejects missing, wrong, and unconfigured tokens', async () => {
		const { db } = makeDb(null)
		expect((await pullApp(db, env).request('/integrations/zeluto/approved-campaigns')).status).toBe(401)
		expect((await pullApp(db, env).request('/integrations/zeluto/approved-campaigns', { headers: { authorization: 'Bearer nope' } })).status).toBe(401)
		expect((await pullApp(db, {}).request('/integrations/zeluto/approved-campaigns', { headers: { authorization: 'Bearer ' } })).status).toBe(401)
	})

	it('returns only approved campaigns whose content still matches the approved hash', async () => {
		const hash = await computeContentHash(creative)
		const good = { id: 'a', tenantId: 't1', name: 'A', ...creative, approvalStatus: 'approved', approvedHash: hash, approvedBy: 'luis', approvedAt: null }
		const tampered = { ...good, id: 'b', subject: 'Edited after approval' }
		const db = { select: () => ({ from: () => ({ where: () => Promise.resolve([good, tampered]) }) }) }
		const res = await pullApp(db, env).request('/integrations/zeluto/approved-campaigns', { headers: { authorization: 'Bearer secret-token' } })
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.items.map((i: { id: string }) => i.id)).toEqual(['a'])
	})
})
