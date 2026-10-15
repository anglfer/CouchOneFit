import { app } from './app.js'
import { config } from './config/index.js'
import { pool } from './config/database.js'
import { jwtKey } from './features/auth/services/tokens.js'

if (!config.databaseUrl)
  throw new Error('Configura DATABASE_URL antes de iniciar la API.')
jwtKey()

const server = app.listen(config.port, () => {
  console.log(`Server running in ${config.nodeEnv} mode on port ${config.port}`)
})

// Graceful shutdown
const shutdown = () => {
  console.log('Shutting down server...')
  server.close(async () => {
    await pool.end()
    console.log('Server shut down cleanly.')
    process.exit(0)
  })
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
