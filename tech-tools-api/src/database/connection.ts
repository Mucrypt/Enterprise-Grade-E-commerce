import pool from '../config/database'
import logger from '../utils/logger'

export const connectDatabase = async (): Promise<void> => {
  try {
    const client = await pool.connect()
    const result = await client.query('SELECT NOW()')
    logger.info(`Database connected at: ${result.rows[0].now}`)
    client.release()
  } catch (error) {
    logger.error('Database connection failed:', error)
    throw error
  }
}

export const query = async (text: string, params?: any[]) => {
  const start = Date.now()
  try {
    const res = await pool.query(text, params)
    const duration = Date.now() - start
    logger.debug('Executed query', { text, duration, rows: res.rowCount })
    return res
  } catch (error) {
    logger.error('Query error', { text, error })
    throw error
  }
}

export const getClient = () => {
  return pool.connect()
}
