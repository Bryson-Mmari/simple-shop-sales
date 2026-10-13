import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'

const databasePath = process.env.NUXT_DATABASE_PATH ?? path.join(process.cwd(), '.data', 'simple-shop.sqlite')
fs.mkdirSync(path.dirname(databasePath), { recursive: true })

export const sqlite = new Database(databasePath)
sqlite.pragma('foreign_keys = ON')
sqlite.pragma('journal_mode = WAL')

export const db = drizzle(sqlite)

export function runSchemaSql(sql: string) {
  sqlite.exec(sql)
}

export function getDatabasePath() {
  return databasePath
}
