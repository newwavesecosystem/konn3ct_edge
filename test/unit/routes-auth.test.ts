import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { authRouter } from '../../src/routes/auth';

// Mock DB
vi.mock('../../src/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock logger
vi.mock('../../src/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
    compare: vi.fn(),
  },
}));

// Mock rate limiters so they don't block tests
vi.mock('../../src/middleware/rateLimiter', () => ({
  authLimiter: (req: any, res: any, next: any) => next(),
  passwordResetLimiter: (req: any, res: any, next: any) => next(),
}));

// Mock requireAuth
vi.mock('../../src/middleware/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.user = { userId: 'user-1', email: 'test@example.com' };
    next();
  },
}));

import { db } from '../../src/db';
import bcrypt from 'bcryptjs';

describe('Auth Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.JWT_SECRET = 'test_secret';

    app = express();
    app.use(express.json());
    app.use(cookieParser());
    // Attach router
    app.use('/auth', authRouter);
  });

  describe('POST /auth/signup', () => {
    it('creates a new user successfully', async () => {
      (db.user.findUnique as any).mockResolvedValueOnce(null);
      (db.user.create as any).mockResolvedValueOnce({
        id: 'user-1',
        email: 'test@example.com',
      });

      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        message: 'User created successfully',
        userId: 'user-1',
      });
      expect(db.user.create).toHaveBeenCalled();
    });

    it('returns 400 if user already exists', async () => {
      (db.user.findUnique as any).mockResolvedValueOnce({ id: 'user-1' });

      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('User with this email already exists');
    });

    it('returns 400 for invalid input schema', async () => {
      const response = await request(app)
        .post('/auth/signup')
        .send({
          email: 'invalid-email',
          password: 'short',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid input');
    });
  });

  describe('POST /auth/login', () => {
    it('logs in successfully and returns token', async () => {
      (db.user.findUnique as any).mockResolvedValueOnce({
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
      });
      (bcrypt.compare as any).mockResolvedValueOnce(true);

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logged in successfully');
      expect(response.body.token).toBeDefined();
      
      const cookies = response.headers['set-cookie'];
      expect(cookies[0]).toMatch(/token=.*HttpOnly/);
    });

    it('returns 401 for wrong email', async () => {
      (db.user.findUnique as any).mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'wrong@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('returns 401 for wrong password', async () => {
      (db.user.findUnique as any).mockResolvedValueOnce({
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
      });
      (bcrypt.compare as any).mockResolvedValueOnce(false);

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
    });

    it('returns 500 on db error', async () => {
      (db.user.findUnique as any).mockRejectedValueOnce(new Error('db down'));

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('POST /auth/push-token', () => {
    it('registers expo push token', async () => {
      const response = await request(app)
        .post('/auth/push-token')
        // Mock requireAuth setting user

        .send({ expoPushToken: 'ExponentPushToken[123]' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Push token registered successfully');
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { expoPushToken: 'ExponentPushToken[123]' }
      });
    });

    it('returns 400 if token missing', async () => {
      const response = await request(app)
        .post('/auth/push-token')

        .send({});

      expect(response.status).toBe(400);
    });

    it('returns 500 on db error', async () => {
      (db.user.update as any).mockRejectedValueOnce(new Error('db down'));
      const response = await request(app)
        .post('/auth/push-token')

        .send({ expoPushToken: 'ExponentPushToken[123]' });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /auth/web-push-token', () => {
    it('registers web push token', async () => {
      const sub = { endpoint: 'https://push' };
      const response = await request(app)
        .post('/auth/web-push-token')

        .send({ subscription: sub });

      expect(response.status).toBe(200);
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { webPushSubscription: JSON.stringify(sub) }
      });
    });

    it('returns 400 if subscription missing', async () => {
      const response = await request(app)
        .post('/auth/web-push-token')

        .send({});

      expect(response.status).toBe(400);
    });

    it('returns 500 on db error', async () => {
      (db.user.update as any).mockRejectedValueOnce(new Error('db down'));
      const sub = { endpoint: 'https://push' };
      const response = await request(app)
        .post('/auth/web-push-token')

        .send({ subscription: sub });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /auth/logout', () => {
    it('clears the cookie', async () => {
      const response = await request(app).post('/auth/logout');
      
      expect(response.status).toBe(200);
      expect(response.headers['set-cookie'][0]).toMatch(/token=;.*Expires=/);
    });
  });

  describe('GET /auth/me', () => {
    it('returns user data for valid token in cookie', async () => {
      (db.user.findUnique as any).mockResolvedValueOnce({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test Name',
      });

      // Generate a valid token
      const jwt = require('jsonwebtoken');
      const token = jwt.sign({ userId: 'user-1', email: 'test@example.com' }, 'test_secret');

      const response = await request(app)
        .get('/auth/me')
        .set('Cookie', [`token=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: 'user-1',
        name: 'Test Name',
        email: 'test@example.com',
      });
    });

    it('returns 401 if no token provided', async () => {
      const response = await request(app).get('/auth/me');
      expect(response.status).toBe(401);
    });

    it('returns 401 if token is invalid', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Cookie', [`token=invalid_token`]);
      expect(response.status).toBe(401);
    });
  });
});
