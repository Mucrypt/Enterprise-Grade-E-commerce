import { Pool, PoolConfig } from 'pg'
import logger from '../utils/logger'
import { resolveWorkerCount } from '../utils/cluster-config'

// When clustered (production, multiple Node workers -- see cluster-config.ts
// and index.ts), EACH worker creates its own Pool, so a flat `max: 20` would
// multiply into workerCount * 20 simultaneous connections against Postgres's
// default max_connections=100. Keep the *combined* ceiling across all
// workers around 80 (leaving headroom for pgAdmin/migrations/psql) by
// dividing per worker; unclustered (dev, or a single worker) keeps the
// original flat 20.
const workerCount = resolveWorkerCount()
const poolMax = workerCount > 1 ? Math.max(5, Math.floor(80 / workerCount)) : 20

const dbConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'techtools',
  user: process.env.DB_USER || 'techtools_user',
  password: process.env.DB_PASSWORD || 'ChangeMe123!',
  max: poolMax, // Maximum number of clients in the pool (per worker process)
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased from 2s to 10s
  statement_timeout: 30000, // Add 30s query timeout
  // Pins every session's TimeZone GUC to UTC regardless of what the
  // Postgres server/OS default happens to be -- nothing else in this
  // codebase set this explicitly before (ADMIN-2B Production Review Round
  // 1 §6). Without it, NOW()/CURRENT_TIMESTAMP, any DATE(timestamptz_col)
  // cast (used by every Sales/Search-Demand trend query's day bucketing),
  // and writes to the schema's several `timestamp without time zone`
  // columns (user_sessions, events_core, alerts) would each depend on
  // whatever timezone Postgres happens to default to on a given host --
  // silently different between a laptop, CI, and the production VPS.
  options: '-c TimeZone=UTC',
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
