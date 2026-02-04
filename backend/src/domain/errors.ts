export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resourceType: string, resourceId: string) {
    super('NOT_FOUND', `${resourceType} not found`, 404, { resource_type: resourceType, resource_id: resourceId });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Invalid or missing credentials') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super('FORBIDDEN', message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('CONFLICT', message, 409, details);
  }
}

export class IdempotencyError extends AppError {
  constructor() {
    super('IDEMPOTENCY_MISMATCH', 'Idempotency key was used with different request body', 409);
  }
}

export class InvalidStateError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('INVALID_STATE_TRANSITION', message, 422, details);
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super('RATE_LIMITED', `Too many requests. Retry after ${retryAfter} seconds.`, 429, { retry_after_seconds: retryAfter });
  }
}
