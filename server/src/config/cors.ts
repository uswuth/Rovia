import { CorsOptions } from 'cors';
import { env } from './env.js';

const parseAllowedOrigins = (): string[] | string | boolean => {
  if (env.CORS_ORIGIN && env.CORS_ORIGIN !== '*') {
    // Support comma-separated list of origins (e.g., "http://localhost:5173,http://localhost:3000")
    return env.CORS_ORIGIN.split(',').map((origin) => origin.trim());
  }
  
  return [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000'
  ];
};

export const corsOptions: CorsOptions = {
  origin: (requestOrigin, callback) => {
    const allowed = parseAllowedOrigins();

    // Allow requests with no origin (like Postman, Bruno, mobile apps, curl)
    if (!requestOrigin) {
      return callback(null, true);
    }

    if (Array.isArray(allowed)) {
      if (allowed.includes(requestOrigin)) {
        return callback(null, true);
      }
      // In development, automatically allow requests from local network IPs (e.g. mobile devices on Wi-Fi)
      if (
        env.NODE_ENV !== 'production' &&
        /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(
          requestOrigin
        )
      ) {
        return callback(null, true);
      }
      return callback(new Error(`Origin '${requestOrigin}' not allowed by CORS`));
    }

    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

export const socketCorsOptions = {
  origin: (requestOrigin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowed = parseAllowedOrigins();

    // Socket handshakes from browsers must provide an origin header matching allowed origins
    if (requestOrigin && Array.isArray(allowed)) {
      if (allowed.includes(requestOrigin)) {
        return callback(null, true);
      }
      if (
        env.NODE_ENV !== 'production' &&
        /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(
          requestOrigin
        )
      ) {
        return callback(null, true);
      }
      return callback(new Error(`Socket origin '${requestOrigin}' not allowed`));
    }

    // In non-browser contexts (e.g., tests, dev tools) without origin header in non-prod
    if (!requestOrigin && env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    return callback(new Error('Origin header required for Socket.io connections'));
  },
  credentials: true
};
