import { app } from './app.js';
import { config } from './config/index.js';
import { pool } from './config/database.js';
import { jwtKey } from './features/auth/services/tokens.js';
import { logger } from './shared/utils/logger.js';
import { errorFields } from './shared/errors/database.js';

if (!config.databaseUrl)
  throw new Error('Configura DATABASE_URL antes de iniciar la API.');
jwtKey();

const server = app.listen(config.port, () => {
  logger.info('server.started', { port: config.port, nodeEnv: config.nodeEnv });
});

// Graceful shutdown
const shutdown = () => {
  logger.info('server.stopping');
  server.close(async () => {
    await pool.end();
    logger.info('server.stopped');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('unhandledRejection', (reason) => {
  logger.error('process.unhandled_rejection', errorFields(reason));
  // Node termina por defecto ante un rechazo sin manejar; se conserva ese comportamiento.
  process.exit(1);
});
process.on('uncaughtException', (error) => {
  logger.error('process.uncaught_exception', errorFields(error));
  process.exit(1);
});
