import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import { getConfig } from '../config'
import * as schema from './schema'

let _db: ReturnType<typeof drizzle> | null = null

export function getDb() {
  if (!_db) {
    const config = getConfig()
    const sql = neon(config.DATABASE_URL)
    _db = drizzle(sql, { schema })
  }
  return _db
}

export type Database = ReturnType<typeof getDb>
