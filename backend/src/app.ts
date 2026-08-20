import fastify, { type FastifyInstance } from 'fastify';
import type { AppConfig } from './config/index.js';
import { fastifyErrorHandler, ErrorCodes } from './errors/index.js';
import { healthRoutes } from './routes/index.js';

export function buildApp(config: AppConfig): FastifyInstance {
  const isTest = config.NODE_ENV === 'test';

  const app = fastify({
    logger: isTest ? false : {
      level: config.LOG_LEVEL
    },
    // Keep forwarded headers untrusted until the deployment proxy topology is known.
    trustProxy: false
  });

  // Register structured error handler
  app.setErrorHandler(fastifyErrorHandler);

  // Register structured 404 handler
  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({
      error: {
        code: ErrorCodes.NOT_FOUND,
        message: 'Route not found'
      }
    });
  });

  // Register routes
  app.register(healthRoutes);

  return app;
}
