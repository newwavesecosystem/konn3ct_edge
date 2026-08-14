import winston from 'winston';
import { S3Transport } from './logger/s3Transport';

const s3Transport = new S3Transport();

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'conn3ct-backend' },
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' 
        ? winston.format.json()
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
    }),
    s3Transport
  ]
});

// Force flush on termination
const gracefulShutdown = async () => {
  console.log('[Logger] Shutting down, flushing logs to S3...');
  await s3Transport.flush();
  process.exit(0);
};

if (process.env.NODE_ENV !== 'test') {
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
  process.on('uncaughtException', async (err) => {
    logger.error('Uncaught Exception', { message: err.message, stack: err.stack });
    await s3Transport.flush();
    process.exit(1);
  });
}

export default logger;
