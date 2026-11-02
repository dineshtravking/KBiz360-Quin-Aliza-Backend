import mongoose from 'mongoose';
import { env } from '#config/env.js';
import { logger } from '#config/logger.js';
import { ApiError } from '#shared/utils/ApiError.js';

// Turns known library errors into ApiError so the client gets a clear message.
function normalize(err) {
  if (err instanceof ApiError) return err;

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return ApiError.badRequest('Validation failed', details);
  }

  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for ${err.path}`);
  }

  if (err?.code === 11000) {
    return ApiError.conflict('Duplicate value', { fields: Object.keys(err.keyValue ?? {}) });
  }

  if (err?.type === 'entity.parse.failed') {
    return ApiError.badRequest('Request body is not valid JSON');
  }

  if (err?.type === 'entity.too.large') {
    return new ApiError(413, 'Request body is too large');
  }

  return null;
}

// Express needs all 4 arguments to treat this as an error handler.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const known = normalize(err);
  const statusCode = known?.statusCode ?? 500;

  if (statusCode >= 500) {
    (req.log ?? logger).error({ err }, 'Unhandled error');
  }

  const body = {
    success: false,
    message: known?.message ?? 'Something went wrong. Please try again later.',
  };
  if (known?.details) body.details = known.details;
  if (!env.isProduction && !known) body.stack = err.stack;

  res.status(statusCode).json(body);
}
