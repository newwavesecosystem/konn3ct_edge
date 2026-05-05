import { Router, Request, Response } from 'express';
import { db } from '../db';
import { logger } from '../logger';

export const healthRouter = Router();

healthRouter.get('/', async (req: Request, res: Response) => {
  try {
    // Check database connection
    await db.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'ok',
      message: 'conn3ct API is running smoothly',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Health check failed - Database unreachable', error);
    res.status(503).json({
      status: 'error',
      message: 'Database connection failed',
      timestamp: new Date().toISOString()
    });
  }
});
