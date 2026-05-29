import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../db';
import { logger } from '../logger';
import { authLimiter, passwordResetLimiter } from '../middleware/rateLimiter';

export const authRouter = Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

authRouter.post('/signup', authLimiter, async (req: Request, res: Response) => {
  try {
    const data = signupSchema.parse(req.body);
    
    const existingUser = await db.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await db.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name
      }
    });

    logger.info(`User signed up: ${user.email}`);
    res.status(201).json({ message: 'User created successfully', userId: user.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    logger.error('Signup error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Register Expo Push Token ---
authRouter.post('/push-token', requireAuth, async (req: Request, res: Response) => {
  try {
    const { expoPushToken } = req.body;
    const userId = req.user!.userId;

    if (!expoPushToken) {
      return res.status(400).json({ error: 'Missing expoPushToken' });
    }

    await db.user.update({
      where: { id: userId },
      data: { expoPushToken }
    });

    res.status(200).json({ message: 'Push token registered successfully' });
  } catch (error) {
    logger.error('Register Push Token error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

authRouter.post('/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await db.user.findUnique({ where: { email: data.email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET!, { expiresIn: '7d' });

    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    logger.info(`User logged in: ${user.email}`);
    res.status(200).json({ message: 'Logged in successfully', token });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.issues });
    }
    logger.error('Login error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

authRouter.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token');
  res.status(200).json({ message: 'Logged out successfully' });
});

authRouter.get('/me', async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string, email: string };
    
    const user = await db.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.status(200).json({
      id: user.id,
      name: user.name || user.email.split('@')[0],
      email: user.email
    });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});
