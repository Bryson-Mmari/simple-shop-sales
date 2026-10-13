import { describe, expect, it } from 'vitest'
import { clearAllTables, createTestUser, createTestSession, countTable } from '../helpers'
import { makeRequest } from '../helpers/request'
import { users } from '../../server/database/schema'

describe('harness self-test', () => {
  it('can create users and sessions and hit routes', async () => {
    clearAllTables()
    const user = await createTestUser()
    expect(user.id).toBeDefined()
    expect(countTable(users)).toBe(1)
    const { sessionId, csrfToken } = createTestSession(user.id)
    expect(sessionId).toBeDefined()
    expect(csrfToken).toBeDefined()
    const res = await makeRequest({ method: 'GET', path: '/api/me', cookies: { shop_session: sessionId } })
    expect(res.status).toBe(200)
  })
})
