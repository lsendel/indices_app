import { getConfig } from '../config'
import { getDb } from './client'
import { tenants } from './schema'

const config = getConfig()
const db = getDb()

const [tenant] = await db
	.insert(tenants)
	.values({ name: 'Dev Tenant', slug: 'dev' })
	.onConflictDoNothing()
	.returning()

if (tenant) {
	console.log('Created dev tenant:', tenant.id)
} else {
	const [existing] = await db.select().from(tenants)
	console.log('Tenant already exists:', existing?.id)
}

process.exit(0)
