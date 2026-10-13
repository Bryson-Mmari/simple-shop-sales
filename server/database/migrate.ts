import fs from 'node:fs'
import path from 'node:path'
import { db, runSchemaSql } from './index'

const migrationPath = path.join(process.cwd(), 'server', 'database', 'migrations', '001_init.sql')

export function ensureDatabase() {
  if (!fs.existsSync(migrationPath)) {
    return
  }

  const sql = fs.readFileSync(migrationPath, 'utf8')
  runSchemaSql(sql)
}

export function migrateDatabase() {
  ensureDatabase()
  return db
}

export default migrateDatabase
