import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import * as schema from './schema'

export function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl)
  return drizzle(sql, { schema })
}

export type Database = ReturnType<typeof createDb>

// Legacy singleton for tests and Bun/Docker fallback
let _db: Database | null = null

export function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL not set')
    _db = createDb(url)
  }
  return _db
}
