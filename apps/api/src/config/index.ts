import dotenv from 'dotenv'

dotenv.config()

export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  allowedOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5000')
    .split(',')
    .map((origin) => origin.trim()),
  databaseUrl: process.env.DATABASE_URL,
  authJwtSecret: process.env.AUTH_JWT_SECRET || '',
  supabase: {
    url: process.env.SUPABASE_URL || '',
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || '',
    secretKey: process.env.SUPABASE_SECRET_KEY || '',
    jwksUrl: process.env.SUPABASE_JWKS_URL || '',
  },
}
