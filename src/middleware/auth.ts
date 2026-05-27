import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../logger';

// Extend Express Request to include user payload
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
      };
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  let headerToken: string | undefined;
  if (authHeader) {
    const [scheme, tok] = authHeader.split(' ');
    if (scheme === 'Bearer' && tok) headerToken = tok;
  }
  const token = req.cookies?.token || headerToken;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('[FATAL] JWT_SECRET environment variable is not set');
    }
    const decoded = jwt.verify(token, secret) as { userId: string; email: string };
    
    req.user = decoded;
    next();
  } catch (error) {
    logger.warn('Failed authentication attempt', { error });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
