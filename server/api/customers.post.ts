import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { db } from '../database'
import { customers } from '../database/schema'
import { requireAuth, validateCsrf } from '../auth'
import { authorizeAction } from '../utils/abac'

const customerSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  validateCsrf(event)
  authorizeAction({ user, action: 'customer.read', resource: { ownerId: user.id, branchId: user.branchId ?? 'branch-main' } })

  const payload = customerSchema.parse(await readBody(event))
  const record = {
    id: randomUUID(),
    name: payload.name,
    phone: payload.phone ?? null,
    email: payload.email || null,
    address: payload.address ?? null,
    createdAt: new Date().toISOString(),
  }

  db.insert(customers).values(record).run()
  return { ok: true, item: record }
})
