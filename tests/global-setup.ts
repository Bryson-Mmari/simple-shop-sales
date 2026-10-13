import { rmSync } from 'node:fs'
import { TEST_DB_BASE_DIR } from './support/test-database'

export default function globalSetup() {
  rmSync(TEST_DB_BASE_DIR, { recursive: true, force: true })

  return () => {
    rmSync(TEST_DB_BASE_DIR, { recursive: true, force: true })
  }
}
