import fastify, { type FastifyInstance } from 'fastify';
import type { AppConfig } from './config/index.js';
import type { PostgresDatabase } from './db/client.js';
import { fastifyErrorHandler, ErrorCodes } from './errors/index.js';
import { healthRoutes } from './routes/index.js';

export interface BuildAppOptions {
  database?: PostgresDatabase;
}

export function buildApp(config: AppConfig, options: BuildAppOptions = {}): FastifyInstance {
  const isTest = config.NODE_ENV === 'test';

  const app = fastify({
    logger: isTest ? false : {
      level: config.LOG_LEVEL
    },
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

  // Clean pool shutdown on Fastify close
  if (options.database) {
    app.addHook('onClose', async () => {
      await options.database?.close();
    });
  }

  // Register routes
  app.register(healthRoutes, {
    database: options.database
  });

  return app;
}
