import { describe, expect, it, beforeEach } from 'vitest'
import { clearAllTables, createTestUser, createTestSession } from '../helpers'
import { makeRequest } from '../helpers/request'
import { SESSION_COOKIE, CSRF_COOKIE } from '../../server/auth'
import { db } from '../../server/database'
import { products } from '../../server/database/schema'
import { seedPrimaryData } from '../../server/database/seed'

describe('CSRF and ABAC enforcement', () => {
  beforeEach(async () => {
    clearAllTables()
    await seedPrimaryData()
  })

  it('rejects state-changing request without CSRF token', async () => {
    const user = await createTestUser()
    const { sessionId } = createTestSession(user.id)
    const res = await makeRequest({
      method: 'POST',
      path: '/api/products',
      cookies: { [SESSION_COOKIE]: sessionId },
      body: { code: 'P1', name: 'Test', costPrice: 10, sellingPrice: 20, stock: 5, minStock: 1 },
    })
    expect(res.status).toBe(403)
  })

  it('allows state-changing request with valid CSRF token', async () => {
    const user = await createTestUser()
    const { sessionId, csrfToken } = createTestSession(user.id)
    const res = await makeRequest({
      method: 'POST',
      path: '/api/products',
      cookies: { [SESSION_COOKIE]: sessionId, [CSRF_COOKIE]: csrfToken },
      headers: { 'x-csrf-token': csrfToken },
      body: { code: 'P-CSRF', name: 'Test', costPrice: 10, sellingPrice: 20, stock: 5, minStock: 1, status: 'active' },
    })
    expect(res.status).toBe(200)
    expect(res.body?.ok).toBe(true)
  })

  it('enforces ABAC deny when no policy permits', async () => {
    const user = await createTestUser({ clearanceLevel: 0 })
    const { sessionId, csrfToken } = createTestSession(user.id)
    const res = await makeRequest({
      method: 'POST',
      path: '/api/products',
      cookies: { [SESSION_COOKIE]: sessionId, [CSRF_COOKIE]: csrfToken },
      headers: { 'x-csrf-token': csrfToken },
      body: { code: 'P-DENY', name: 'Test', costPrice: 10, sellingPrice: 20, stock: 5, minStock: 1 },
    })
    expect(res.status).toBe(403)
  })

  it('prevents cross-branch data access where scoped', async () => {
    const userA = await createTestUser({ branchId: 'branch-a' })
    const userB = await createTestUser({ branchId: 'branch-main' })
    const { sessionId: sB, csrfToken: cB } = createTestSession(userB.id)
    const create = await makeRequest({
      method: 'POST',
      path: '/api/products',
      cookies: { [SESSION_COOKIE]: sB, [CSRF_COOKIE]: cB },
      headers: { 'x-csrf-token': cB },
      body: { code: 'PB', name: 'PB', costPrice: 1, sellingPrice: 2, stock: 1, minStock: 0 },
    })
    expect(create.status).toBe(200)
    const pid = create.body?.item?.id
    const { sessionId: sA } = createTestSession(userA.id)
    const res = await makeRequest({ method: 'GET', path: '/api/products', cookies: { [SESSION_COOKIE]: sA } })
    expect(res.status).toBe(200)
    if (res.body?.items) {
      expect(res.body.items.find((i: any) => i.id === pid)).toBeUndefined()
    }
  })
})
