import { requireAuth } from '../auth'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      departmentId: user.departmentId,
      accountStatus: user.accountStatus,
      branchId: user.branchId,
      clearanceLevel: user.clearanceLevel,
      discountLimit: user.discountLimit,
    },
  }
})
