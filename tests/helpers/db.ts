import { db } from '../../server/database'
import {
  abacPolicies,
  auditLogs,
  payments,
  products,
  saleItems,
  sales,
  sessions,
  stockMovements,
  users,
} from '../../server/database/schema'

export function clearAllTables() {
  db.delete(auditLogs).run()
  db.delete(stockMovements).run()
  db.delete(payments).run()
  db.delete(saleItems).run()
  db.delete(sales).run()
  db.delete(products).run()
  db.delete(sessions).run()
  db.delete(abacPolicies).run()
  db.delete(users).run()
}

export function countTable(table: any): number {
  return db.select().from(table).all().length
}
