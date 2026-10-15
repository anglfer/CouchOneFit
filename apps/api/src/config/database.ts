import { Pool } from 'pg'
import { config } from './index.js'
export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 5,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  query_timeout: 10000,
})
pool.on('error', () => console.error('Conexión de base de datos interrumpida.'))
