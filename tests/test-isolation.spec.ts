import { describe, expect, it } from 'vitest'
import { tmpdir } from 'node:os'
import { getDatabasePath, sqlite } from '../server/database'
import { TEST_DB_BASE_DIR, getWorkerTestDatabasePath } from './support/test-database'

describe('test database isolation', () => {
  it('points the database at a dedicated temporary path', () => {
    const databasePath = getDatabasePath()

    expect(databasePath).toBe(getWorkerTestDatabasePath())
    expect(databasePath.startsWith(TEST_DB_BASE_DIR)).toBe(true)
    expect(databasePath.startsWith(tmpdir())).toBe(true)
  })

  it('never points the database at the developer data directory', () => {
    const databasePath = getDatabasePath()

    expect(databasePath).not.toContain('simple-shop.sqlite')
  })

  it('applies the schema to the isolated database', () => {
    const row = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'abac_policies'")
      .get() as { name: string } | undefined

    expect(row?.name).toBe('abac_policies')
  })
})
