import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { getWorkerTestDatabasePath } from './support/test-database'

const testDatabasePath = getWorkerTestDatabasePath()

mkdirSync(path.dirname(testDatabasePath), { recursive: true })

process.env.NUXT_DATABASE_PATH = testDatabasePath

const { migrateDatabase } = await import('../server/database/migrate')

migrateDatabase()
