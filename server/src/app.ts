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

// Security Middlewares
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

// Body Parsers & Cookie Parser
// In development we accept comments and trailing commas in JSON bodies so
// credentials can be toggled in an API client without editing the payload.
if (env.NODE_ENV === 'production') {
  app.use(express.json({ limit: '16kb' }));
} else {
  app.use(tolerantJsonParser({ limit: '16kb' }));
}
app.use(express.urlencoded({ extended: true, limit: '16kb' }));
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

// Friendly API Root Welcome Endpoints
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

// Mount Central API Router
app.use('/api', apiRouter);

// 404 & Centralized Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
