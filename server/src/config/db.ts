import mongoose from 'mongoose';
import dns from 'dns';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

// IPv4-first DNS avoids the Node dual-stack resolution issues with MongoDB SRV lookups
try {
  dns.setDefaultResultOrder('ipv4first');
  // Local ISP DNS often blocks SRV lookups
  if (env.NODE_ENV !== 'production') {
    dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
  }
} catch {
  // Ignore: keep the system default DNS behaviour
}

let isConnected = false;

export const connectDB = async (): Promise<void> => {
  if (!env.MONGO_URI) {
    logger.warn('MONGO_URI is not set. Database connection skipped.');
    return;
  }

  if (isConnected) {
    logger.info('Using existing MongoDB connection.');
    return;
  }

  try {
    const connectionInstance = await mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: 15000,
      family: 4
    });

    isConnected = true;
    logger.info(`MongoDB connected successfully! Host: ${connectionInstance.connection.host}`);
  } catch (error) {
    const err = error as Error;
    logger.error(`MongoDB connection failed: ${err.message}`);
    if (env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  logger.warn('MongoDB connection lost. Retrying...');
});

mongoose.connection.on('error', (err: Error) => {
  logger.error(`MongoDB connection error: ${err.message}`);
});

export const getDBStatus = (): string => {
  const states: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  return states[mongoose.connection.readyState] || 'unknown';
};

export const closeDB = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed cleanly.');
  }
};
