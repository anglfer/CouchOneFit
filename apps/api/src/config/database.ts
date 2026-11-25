import { Pool } from 'pg'
import { config } from './index.js'
import { logger } from '../shared/utils/logger.js'
export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 5,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  query_timeout: 10000,
})
pool.on('error', (error: Error & { code?: string }) =>
  logger.error('db.pool_error', {
    errorName: error.name,
    errorCode: error.code,
    message: error.message,
  })
)
