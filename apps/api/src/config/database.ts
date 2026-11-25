import { Pool } from 'pg'
import { config } from './index.js'
import { logger } from '../shared/utils/logger.js'
import { errorFields } from '../shared/errors/database.js'
export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 5,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  query_timeout: 10000,
})
pool.on('error', (error) => logger.error('db.pool_error', errorFields(error)))
