import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { EnvConfig } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envLocalPath = path.resolve(__dirname, '../../.env.local');
const envPath = path.resolve(__dirname, '../../.env');

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

// Secrets are read from <NAME>_FILE mounts and never defaulted: a missing value must fail loudly.
const readSecret = (name: string): string | undefined => {
  const filePath = process.env[`${name}_FILE`];
  if (!filePath) return undefined;
  try {
    if (!fs.existsSync(filePath)) return undefined;
    const value = fs.readFileSync(filePath, 'utf-8').trim();
    return value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
};

const resolveSecret = (name: string): string | undefined =>
  (readSecret(name) ?? process.env[name])?.replace(/^["']|["']$/g, '') || undefined;

const rawMongoUri = resolveSecret('MONGO_URI') ?? resolveSecret('MONGODB_URI');
const accessSecret = resolveSecret('JWT_ACCESS_SECRET');
const refreshSecret = resolveSecret('JWT_REFRESH_SECRET');
const rootSharedSecret = resolveSecret('ROOT_SHARED_SECRET');
const serverAdminInitialPassword = resolveSecret('SERVER_ADMIN_INITIAL_PASSWORD');
const s3AccessKeyId = resolveSecret('AWS_ACCESS_KEY_ID');
const s3SecretKey = resolveSecret('AWS_SECRET_ACCESS_KEY');
const s3Bucket = resolveSecret('AWS_S3_BUCKET') || process.env.AWS_S3_BUCKET;

// Non-secret settings are the only ones allowed a default value.
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

const validateEnv = (): void => {
  const missing: string[] = [];
  if (!rawMongoUri) missing.push('MONGO_URI (or MONGO_URI_FILE / MONGODB_URI)');
  if (!accessSecret) missing.push('JWT_ACCESS_SECRET (or JWT_ACCESS_SECRET_FILE)');
  if (!refreshSecret) missing.push('JWT_REFRESH_SECRET (or JWT_REFRESH_SECRET_FILE)');
  if (!rootSharedSecret) missing.push('ROOT_SHARED_SECRET (or ROOT_SHARED_SECRET_FILE)');

  if (isProduction && !s3Bucket) {
    missing.push('AWS_S3_BUCKET (or AWS_S3_BUCKET_FILE)');
  }

  if (missing.length > 0) {
    console.error(
      `[CONFIG ERROR] Missing required configuration:\n  - ${missing.join('\n  - ')}\n` +
      'Set them in server/.env for local work, or mount Docker secrets from server/secrets/ ' +
      '(node server/scripts/generate-secrets.mjs).'
    );
    process.exit(1);
  }

  // Object-storage credentials are fatal only in production; dev storage is opt-in.
  if (isProduction && (!s3AccessKeyId || !s3SecretKey)) {
    console.error(
      '[CONFIG ERROR] Missing required configuration:\n  - AWS_ACCESS_KEY_ID (or AWS_ACCESS_KEY_ID_FILE)\n' +
      '  - AWS_SECRET_ACCESS_KEY (or AWS_SECRET_ACCESS_KEY_FILE)'
    );
    process.exit(1);
  }
};

validateEnv();

export const env: Readonly<EnvConfig> = Object.freeze({
  NODE_ENV,
  PORT: parseInt(process.env.PORT || '5000', 10),
  MONGO_URI: rawMongoUri as string,
  CORS_ORIGIN: process.env.CORS_ORIGIN || (isProduction ? '' : '*'),
  CLIENT_URL: process.env.CLIENT_URL,
  JWT_ACCESS_SECRET: accessSecret as string,
  // Access token expiry matching client requirement (8 hours).
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '8h',
  JWT_REFRESH_SECRET: refreshSecret as string,
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '7d',
  ROOT_SHARED_SECRET: rootSharedSecret as string,
  SERVER_ADMIN_INITIAL_PASSWORD: serverAdminInitialPassword,
  // S3 credentials go through resolveSecret, never a default; non-secret settings may default.
  // Internal endpoint: used for HeadObject/Delete/reads; must be the Compose-internal hostname in Docker.
  AWS_ENDPOINT_URL: process.env.AWS_ENDPOINT_URL || 'http://localhost:4566',
  // Host-reachable endpoint: only used when presigning URLs a browser will call.
  AWS_PUBLIC_ENDPOINT_URL: process.env.AWS_PUBLIC_ENDPOINT_URL || 'http://localhost:4566',
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  AWS_ACCESS_KEY_ID: s3AccessKeyId,
  AWS_SECRET_ACCESS_KEY: s3SecretKey,
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || 'intellmeet-bucket',

  // AI is hosted (Groq/OpenRouter); FFmpeg still runs locally to make the 16 kHz mono WAV the transcriber expects.
  FFMPEG_PATH: process.env.FFMPEG_PATH || 'ffmpeg',

  // Deliberately unvalidated: the AI pipeline is opt-in, so a missing key only 503s on request.
  GROQ_API_KEY: resolveSecret('GROQ_API_KEY'),
  GROQ_BASE_URL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
  GROQ_TRANSCRIBE_MODEL: process.env.GROQ_TRANSCRIBE_MODEL || 'whisper-large-v3',
  // An hour-long meeting is far past the default request timeout.
  GROQ_TIMEOUT_MS: parseInt(process.env.GROQ_TIMEOUT_MS || '600000', 10),
  OPENROUTER_API_KEY: resolveSecret('OPENROUTER_API_KEY'),
  OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  // Free text model: audio is not on the free tier, so only the transcript text goes here.
  OPENROUTER_SUMMARY_MODEL: process.env.OPENROUTER_SUMMARY_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free',
  // Tried in order when the primary model is rate-limited; verified to honour json_object responses.
  OPENROUTER_FALLBACK_MODELS: (process.env.OPENROUTER_FALLBACK_MODELS ??
    'nvidia/nemotron-3-ultra-550b-a55b:free,poolside/laguna-s-2.1:free,liquid/lfm-2.5-2.6b:free')
    .split(',')
    .map((model) => model.trim())
    .filter((model) => model.length > 0),
  OPENROUTER_TIMEOUT_MS: parseInt(process.env.OPENROUTER_TIMEOUT_MS || '180000', 10)
});
