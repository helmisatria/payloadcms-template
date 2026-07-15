import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL || ''

export const postgresPool = new Pool({
  connectionString,
  max: 10, // Maximum number of connections in the pool
})
