import { app } from './app.js'
import { config } from './config/index.js'

const server = app.listen(config.port, () => {
  console.log(`Server running in ${config.nodeEnv} mode on port ${config.port}`)
})

// Graceful shutdown
const shutdown = () => {
  console.log('Shutting down server...')
  server.close(() => {
    console.log('Server shut down cleanly.')
    process.exit(0)
  })
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
