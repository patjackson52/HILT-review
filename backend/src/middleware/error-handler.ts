import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../domain/errors.js';
import { ZodError } from 'zod';

export function errorHandler(
  error: FastifyError | AppError | ZodError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  request.log.error(error);

  // Zod validation errors
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: {
          fields: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
      },
    });
  }

  // Custom app errors
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        ...(error.statusCode >= 500 && { request_id: request.id }),
      },
    });
  }

  // Fastify errors (validation, etc.)
  if ('statusCode' in error && error.statusCode && error.statusCode < 500) {
    return reply.status(error.statusCode).send({
      error: {
        code: 'REQUEST_ERROR',
        message: error.message,
      },
    });
  }

  // Unknown errors
  return reply.status(500).send({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      request_id: request.id,
    },
  });
}
