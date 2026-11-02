import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

mongoose.set('strictQuery', true);

export async function connectDatabase() {
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB error'));

  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
    // Indexes are built by a deploy script in production, not on every boot.
    autoIndex: !env.isProduction,
  });

  logger.info({ db: mongoose.connection.name }, 'MongoDB connected');
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
  logger.info('MongoDB connection closed');
}

const READY_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

export function databaseStatus() {
  return READY_STATES[mongoose.connection.readyState] ?? 'unknown';
}
