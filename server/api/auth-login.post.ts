import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { readBody } from 'h3'
import { db } from '../database/index.ts'
import { users } from '../database/schema.ts'
import { createUserSession, setAuthCookies, verifyPassword } from '../auth/index.ts'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = loginSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid login payload.' })
  }

  const user = db.select().from(users).where(eq(users.email, parsed.data.email.toLowerCase())).get() as typeof users.$inferSelect | undefined
  if (!user || user.accountStatus !== 'active') {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password.' })
  }

  const passwordMatches = await verifyPassword(parsed.data.password, user.passwordHash)
  if (!passwordMatches) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password.' })
  }

  const { sessionId, csrfToken, expiresAt } = await createUserSession(user.id)
  setAuthCookies(event, sessionId, csrfToken, expiresAt)

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      departmentId: user.departmentId,
      branchId: user.branchId,
      clearanceLevel: user.clearanceLevel,
      discountLimit: user.discountLimit,
      accountStatus: user.accountStatus,
    },
    csrfToken,
  }
})
