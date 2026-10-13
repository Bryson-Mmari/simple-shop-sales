import { describe, expect, it, beforeEach } from 'vitest'
import { clearAllTables, createTestUser, createTestSession } from '../helpers'
import { makeRequest } from '../helpers/request'
import { SESSION_COOKIE, CSRF_COOKIE } from '../../server/auth'

describe('route authentication and basic security', () => {
  beforeEach(() => {
    clearAllTables()
  })

  it('returns 401 when accessing authenticated route without session', async () => {
    const res = await makeRequest({ method: 'GET', path: '/api/me' })
    expect(res.status).toBe(401)
  })

  it('returns user data for authenticated request', async () => {
    const user = await createTestUser()
    const { sessionId, csrfToken } = createTestSession(user.id)
    const res = await makeRequest({
      method: 'GET',
      path: '/api/me',
      cookies: { [SESSION_COOKIE]: sessionId, [CSRF_COOKIE]: csrfToken },
    })
    expect(res.status).toBe(200)
    expect(res.body?.ok).toBe(true)
    expect(res.body?.user?.email).toBe(user.email)
  })

  it('returns 401 for login with invalid credentials', async () => {
    const res = await makeRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'nope@example.com', password: 'wrongpass123' },
    })
    expect(res.status).toBe(401)
  })

  it('allows login with valid credentials', async () => {
    const user = await createTestUser()
    const res = await makeRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: user.email, password: user.password },
    })
    expect(res.status).toBe(200)
    expect(res.body?.ok).toBe(true)
    expect(res.body?.csrfToken).toBeDefined()
  })
})
