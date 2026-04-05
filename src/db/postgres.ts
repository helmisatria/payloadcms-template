import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL || ''

export const postgresPool = new Pool({
  connectionString,
})
