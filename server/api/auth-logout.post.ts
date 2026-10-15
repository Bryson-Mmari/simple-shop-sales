import { clearAuthCookies, requireAuth } from '../auth/index.ts'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const sessionId = event.node.req.headers.cookie?.match(/shop_session=([^;]+)/)?.[1]
  if (sessionId) {
    const { db } = await import('../database')
    db.delete((await import('../database/schema')).sessions).where((await import('drizzle-orm')).eq((await import('../database/schema')).sessions.id, sessionId)).run()
  }

  clearAuthCookies(event)
  return { ok: true, userId: user.id }
})
