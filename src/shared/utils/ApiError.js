// An error we expect and control (bad input, not found, no permission...).
// Throw it from any layer; error.middleware turns it into a clean JSON response.
export class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }

  static badRequest(message = 'Bad request', details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'You do not have permission to do this') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  static conflict(message = 'Resource already exists', details) {
    return new ApiError(409, message, details);
  }

  // The input is valid, but a business rule says no (period locked, not enough stock...).
  static unprocessable(message, details) {
    return new ApiError(422, message, details);
  }

  // A bug or missing setup on our side (e.g. a system account was never seeded).
  static internal(message) {
    return new ApiError(500, message);
  }
}
