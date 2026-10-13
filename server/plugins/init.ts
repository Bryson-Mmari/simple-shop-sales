import { migrateDatabase } from '../database/migrate'
import { seedPrimaryData } from '../database/seed'

export default defineNitroPlugin(async () => {
  migrateDatabase()
  await seedPrimaryData()
})
