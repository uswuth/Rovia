import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import apiRouter from './routes/index.js';
import { notFoundHandler } from './middlewares/notFoundHandler.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { ApiResponse } from './utils/apiResponse.js';
import { corsOptions } from './config/cors.js';
import { swaggerSpec } from './config/swagger.js';
import { env } from './config/env.js';
import { tolerantJsonParser } from './middlewares/tolerantJson.js';

const app: Application = express();

app.use(
  helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production' ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"]
      }
    } : false, // allow Swagger UI and dev tooling in local development
    frameguard: { action: 'deny' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  })
);
app.use(cors(corsOptions));

// In development we accept comments and trailing commas in JSON bodies so
// credentials can be toggled in an API client without editing the payload.
const JSON_BODY_LIMIT = '16kb';
// A profile update may carry an avatar as a base64 data URL. The client accepts
// images up to 2 MB, which becomes ~2.7 MB once encoded, so that single route
// gets a larger budget while every other body keeps the small limit.
const AVATAR_JSON_BODY_LIMIT = '4mb';

const buildJsonParser = (limit: string) =>
  env.NODE_ENV === 'production'
    ? express.json({ limit })
    : tolerantJsonParser({ limit });

const defaultJsonParser = buildJsonParser(JSON_BODY_LIMIT);
const avatarJsonParser = buildJsonParser(AVATAR_JSON_BODY_LIMIT);

const isProfileUpdate = (req: Request): boolean =>
  req.method === 'PUT' && /^\/api\/v1\/user-details\/?$/.test(req.path);

app.use((req: Request, res: Response, next) => {
  const parser = isProfileUpdate(req) ? avatarJsonParser : defaultJsonParser;
  parser(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));
app.use(cookieParser());

// Quiet handler for automatic browser favicon requests
app.get('/favicon.ico', (_req: Request, res: Response) => {
  res.status(204).end();
});

// OpenAPI Spec and Swagger UI Documentation (Disabled in production)
if (env.NODE_ENV !== 'production') {
  app.get('/api/docs/json', (_req: Request, res: Response) => {
    res.json(swaggerSpec);
  });

  try {
    const swaggerUi = await import('swagger-ui-express');
    app.use('/api/docs', swaggerUi.default.serve, swaggerUi.default.setup(swaggerSpec));
  } catch {
    // Graceful fallback
  }
}

const rootWelcomeHandler = (_req: Request, res: Response): Response => {
  return ApiResponse.success(res, 'Welcome to IntellMeet API', {
    service: 'IntellMeet Backend API',
    version: '1.0.0',
    documentation: '/api/docs',
    healthCheck: '/api/v1/health'
  });
};

app.get('/', rootWelcomeHandler);
app.get('/api', rootWelcomeHandler);

// Backwards-compatible legacy health endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'IntellMeet Server is ready' });
});

app.use('/api/v1', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
