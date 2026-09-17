import winston from 'winston';
import path from 'path';
import { S3Transport } from './logger/s3Transport';

const s3Transport = new S3Transport();

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' 
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
  }),
  s3Transport
];

if (process.env.NODE_ENV !== 'test' || process.env.LOG_FILE) {
  try {
    const logFilePath = process.env.LOG_FILE || path.resolve(process.cwd(), 'backend.log');
    transports.push(new winston.transports.File({ filename: logFilePath }));
  } catch (err) {
    console.warn('[Logger] Failed to initialize File transport:', err);
  }
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'conn3ct-backend' },
  transports
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
