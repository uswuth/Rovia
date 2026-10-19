import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError.js';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

/** In-memory sliding-window rate limiter. Avoids extra third-party dependencies while providing solid brute-force protection. */
export const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  message?: string;
}) => {
  const hits = new Map<string, RateLimitRecord>();

  // Periodically evict expired entries to prevent memory growth
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (record.resetTime <= now) {
        hits.delete(key);
      }
    }
  }, Math.max(options.windowMs, 60000));

  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return (req: Request, _res: Response, next: NextFunction): void => {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';

    const now = Date.now();
    const record = hits.get(ip);

    if (!record || record.resetTime <= now) {
      hits.set(ip, {
        count: 1,
        resetTime: now + options.windowMs
      });
      return next();
    }

    record.count += 1;

    if (record.count > options.max) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      return next(
        ApiError.tooManyRequests(
          options.message ||
            `Too many requests from this IP. Please try again after ${retryAfterSeconds} seconds.`
        )
      );
    }

    return next();
  };
};

/**
 * 20 attempts per 15 minutes window for sensitive authentication endpoints.
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many authentication attempts. Please try again in 15 minutes.'
});
