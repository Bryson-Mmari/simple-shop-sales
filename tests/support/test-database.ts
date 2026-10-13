import { tmpdir } from 'node:os'
import path from 'node:path'

export const TEST_DB_BASE_DIR = path.join(tmpdir(), 'simple-shop-sales-tests')

export function getWorkerTestDatabasePath() {
  const workerId = process.env.VITEST_WORKER_ID ?? process.env.VITEST_POOL_ID ?? String(process.pid)
  return path.join(TEST_DB_BASE_DIR, `worker-${workerId}.sqlite`)
}
