import type { FastifyPluginAsync } from 'fastify';
import type { PostgresDatabase } from '../db/client.js';

export interface HealthRouteOptions {
  database?: PostgresDatabase;
}

export const healthRoutes: FastifyPluginAsync<HealthRouteOptions> = async (fastify, opts) => {
  // Liveness probe: lightweight, independent of external dependencies
  fastify.get('/health', async (_request, reply) => {
    return reply.status(200).send({ status: 'ok' });
  });

  // Readiness probe: checks database connectivity if database is configured
  fastify.get('/ready', async (_request, reply) => {
    if (opts.database) {
      const isDbHealthy = await opts.database.isHealthy();
      if (!isDbHealthy) {
        return reply.status(503).send({ status: 'not_ready' });
      }
    }

    return reply.status(200).send({ status: 'ready' });
  });
};
