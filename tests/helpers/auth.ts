import { randomUUID } from 'node:crypto'
import { db } from '../../server/database'
import { sessions, users } from '../../server/database/schema'
import { hashPassword } from '../../server/auth'

export interface TestUser {
  id: string
  email: string
  password: string
  clearanceLevel: number
  departmentId?: string | null
  branchId?: string | null
  discountLimit?: number
}

export async function createTestUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
  const userId = randomUUID()
  const email = overrides.email ?? `test-${userId}@example.com`
  const password = overrides.password ?? 'Password123!'
  const passwordHash = await hashPassword(password)

  db.insert(users).values({
    id: userId,
    email,
    passwordHash,
    firstName: 'Test',
    lastName: 'User',
    accountStatus: 'active',
    departmentId: overrides.departmentId ?? 'management',
    clearanceLevel: overrides.clearanceLevel ?? 5,
    discountLimit: overrides.discountLimit ?? 30,
    branchId: overrides.branchId ?? 'branch-main',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }).run()

  return { id: userId, email, password, clearanceLevel: overrides.clearanceLevel ?? 5, ...overrides }
}

export function createTestSession(userId: string): { sessionId: string; csrfToken: string } {
  const sessionId = randomUUID() + randomUUID()
  const csrfToken = randomUUID() + randomUUID()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString()

  db.insert(sessions).values({
    id: sessionId,
    userId,
    tokenHash: sessionId, // Not critical for harness tests
    expiresAt,
    createdAt: new Date().toISOString(),
  }).run()

  return { sessionId, csrfToken }
}
