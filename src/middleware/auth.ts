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

export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  let headerToken: string | undefined;
  if (authHeader) {
    const [scheme, tok] = authHeader.split(' ');
    if (scheme === 'Bearer' && tok) headerToken = tok;
  }
  const token = req.cookies?.token || headerToken;

  if (!token) {
    return next();
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (secret) {
      const decoded = jwt.verify(token, secret) as { userId: string; email: string };
      req.user = decoded;
    }
  } catch (error) {
    // Silently ignore invalid tokens in optional auth
  }
  next();
};

import { db } from '../db';

export const requireActiveSubscription = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const sub = await db.subscription.findFirst({
      where: {
        userId: req.user.userId,
        status: 'active',
        currentPeriodEnd: { gt: new Date() }
      }
    });
    
    if (!sub) {
      return res.status(403).json({ error: 'Subscription required or expired' });
    }
    next();
  } catch (err) {
    logger.error('Error checking subscription', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const requireRecordingAccess = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const recordingId = req.params.recordingId || req.body.recordingId || req.query.recordingId as string;
  if (!recordingId) {
    return res.status(400).json({ error: 'Recording ID is required' });
  }

  try {
    const recording = await db.recording.findUnique({ where: { id: recordingId } });
    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    // Owner always has access
    if (recording.ownerId === req.user.userId) {
      return next();
    }

    // Free recording logic could go here
    if (!recording.isPaid) {
      return next();
    }

    // Paid logic
    const successfulPayment = await db.paymentTransaction.findFirst({
      where: {
        recordingId: recording.id,
        userId: req.user.userId,
        status: 'success',
        kind: 'recording'
      }
    });

    if (!successfulPayment) {
      return res.status(403).json({ error: 'Payment required to access this recording' });
    }

    next();
  } catch (err) {
    logger.error('Error checking recording access', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
