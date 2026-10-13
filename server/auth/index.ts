import { randomBytes, randomUUID } from 'node:crypto'
import { eq, and, gt } from 'drizzle-orm'
import { getCookie, setCookie, deleteCookie, type H3Event } from 'h3'
import argon2 from 'argon2'
import { db } from '../database'
import { sessions, users } from '../database/schema'

export const SESSION_COOKIE = 'shop_session'
export const CSRF_COOKIE = 'shop_csrf'

export async function hashPassword(password: string) {
  return argon2.hash(password)
}

export async function verifyPassword(password: string, passwordHash: string) {
  return argon2.verify(passwordHash, password)
}

export function generateSessionId() {
  return randomBytes(32).toString('hex')
}

export function generateCsrfToken() {
  return randomBytes(24).toString('hex')
}

export async function createUserSession(userId: string) {
  const token = generateSessionId()
  const csrfToken = generateCsrfToken()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString()

  db.insert(sessions).values({
    id: token,
    userId,
    tokenHash: await hashPassword(token),
    expiresAt,
    createdAt: new Date().toISOString(),
  }).run()

  return { sessionId: token, csrfToken, expiresAt }
}

export async function getCurrentSession(event: H3Event) {
  const sessionId = getCookie(event, SESSION_COOKIE)
  if (!sessionId) {
    return null
  }

  const session = db.select().from(sessions).where(eq(sessions.id, sessionId)).get() as typeof sessions.$inferSelect | undefined
  if (!session) {
    return null
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    db.delete(sessions).where(eq(sessions.id, sessionId)).run()
    return null
  }

  const user = db.select().from(users).where(eq(users.id, session.userId)).get() as typeof users.$inferSelect | undefined
  if (!user) {
    return null
  }

  return { session, user }
}

export async function requireAuth(event: H3Event) {
  const session = await getCurrentSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required.' })
  }

  return session.user
}

export function setAuthCookies(event: H3Event, sessionId: string, csrfToken: string, expiresAt: string) {
  setCookie(event, SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(expiresAt),
  })

  setCookie(event, CSRF_COOKIE, csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(expiresAt),
  })
}

export function clearAuthCookies(event: H3Event) {
  deleteCookie(event, SESSION_COOKIE)
  deleteCookie(event, CSRF_COOKIE)
}

export function validateCsrf(event: H3Event) {
  const method = event.node.req.method ?? 'GET'
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return
  }

  const cookieToken = getCookie(event, CSRF_COOKIE)
  const headerToken = event.node.req.headers['x-csrf-token']

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    throw createError({ statusCode: 403, statusMessage: 'CSRF validation failed.' })
  }
}

export function buildSubjectFromUser(user: typeof users.$inferSelect) {
  return {
    userId: user.id,
    accountStatus: user.accountStatus,
    departmentId: user.departmentId,
    authorizedBranchIds: user.branchId ? [user.branchId] : [],
    clearanceLevel: user.clearanceLevel,
    discountLimit: user.discountLimit,
    branchId: user.branchId,
    email: user.email,
  }
}
