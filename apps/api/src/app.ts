import express, { type Express, type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import { config } from './config/index.js'

export const app: Express = express()

// Global Middlewares
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
  })
})

// Global Error Handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err)
  res.status(500).json({
    error: {
      message: config.nodeEnv === 'production' ? 'Internal server error' : err.message,
    },
  })
})

export default app
