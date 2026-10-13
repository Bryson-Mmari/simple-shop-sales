import { getCurrentSession, getCurrentSession as getSession } from '../auth'

export default defineEventHandler(async (event) => {
  const session = await getCurrentSession(event)
  const csrfToken = event.node.req.headers.cookie?.match(/shop_csrf=([^;]+)/)?.[1]
  return {
    ok: true,
    csrfToken: csrfToken || '',
    sessionActive: !!session,
  }
})
