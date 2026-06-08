/**
 * Rate Limiting Middleware
 * ========================
 * Uses express-rate-limit with in-memory store (single pod).
 * For multi-pod (K8s) deployments, swap to rate-limit-redis store — deferred.
 *
 * Limit groups:
 *  authLimiter          — login / signup (brute force protection)
 *  passwordResetLimiter — password reset requests (email spam prevention)
 *  paymentLimiter       — payment init and webhook (fraud prevention)
 *  telephonyLimiter     — outbound call-out (toll fraud prevention)
 *  generalLimiter       — all other routes (DDoS headroom)
 */

import rateLimit from 'express-rate-limit';
import { Request } from 'express';

/** Standard error handler shared by all limiters */
const rateLimitHandler = (req: any, res: any) => {
  res.status(429).json({
    error: 'Too many requests — please slow down and try again later.',
    retryAfter: res.getHeader('Retry-After'),
  });
};

/**
 * Auth limiter — login and signup
 * 5 requests per 15 minutes per IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
});

/**
 * Password reset limiter — /auth/request-password-reset
 * 5 requests per hour per IP (prevents email bombing)
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: 'Too many password reset requests. Please try again in 1 hour.',
});

/**
 * Payment limiter — initialize and webhook endpoints
 * 30 requests per minute per IP
 */
export const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: 'Too many payment requests. Please try again shortly.',
});

/**
 * Telephony callout limiter
 * 10 outbound calls per hour per IP (toll fraud prevention)
 */
export const telephonyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: 'Too many call-out attempts. Please try again in 1 hour.',
});

/**
 * General API limiter — applied globally to all routes
 * 100 requests per minute per IP (DDoS headroom)
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  // Skip rate limiting for health checks
  skip: (req: Request) => req.path.startsWith('/health'),
});
