import { Pool, PoolConfig } from 'pg'
import logger from '../utils/logger'

const dbConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'techtools',
  user: process.env.DB_USER || 'techtools_user',
  password: process.env.DB_PASSWORD || 'ChangeMe123!',
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased from 2s to 10s
  statement_timeout: 30000, // Add 30s query timeout
}

const pool = new Pool(dbConfig)

pool.on('connect', () => {
  logger.debug('Database connection established')
})

pool.on('error', (err) => {
  logger.error('Unexpected database error', err)
  process.exit(-1)
})

export default pool

// Helper function for transactions
export const withTransaction = async <T>(
  callback: (client: any) => Promise<T>,
): Promise<T> => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
