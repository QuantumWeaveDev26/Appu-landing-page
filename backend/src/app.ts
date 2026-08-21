import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastify, { type FastifyInstance } from 'fastify';
import type { AppConfig } from './config/index.js';
import type { TransactionalQueryable } from './db/types.js';
import { SupabaseAuthVerifier, type AuthVerifier } from './domain/auth/index.js';
import { DefaultRazorpayClient, type RazorpayClient } from './domain/razorpay/index.js';
import { DefaultN8nClient, type N8nClient } from './domain/gateway/index.js';
import { fastifyErrorHandler, ErrorCodes } from './errors/index.js';
import {
  healthRoutes,
  authRoutes,
  householdRoutes,
  childrenRoutes,
  plansRoutes,
  subscriptionsRoutes,
  webhooksRoutes,
  appuGatewayRoutes
} from './routes/index.js';

export interface ClosableDatabase extends TransactionalQueryable {
  isHealthy?(): Promise<boolean>;
  close(): Promise<void>;
}

export interface BuildAppOptions {
  database?: ClosableDatabase | TransactionalQueryable;
  authVerifier?: AuthVerifier;
  razorpayClient?: RazorpayClient;
  n8nClient?: N8nClient;
}

export function buildApp(config: AppConfig, options: BuildAppOptions = {}): FastifyInstance {
  const isTest = config.NODE_ENV === 'test';

  const app = fastify({
    logger: isTest ? false : {
      level: config.LOG_LEVEL
    },
    trustProxy: false
  });

  // Enable CORS for client / browser access
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    reply.header(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Razorpay-Signature, X-Razorpay-Event-Id'
    );
    if (request.method === 'OPTIONS') {
      return reply.status(204).send();
    }
  });

  // Preserve raw request body string for cryptographic webhook signature verification
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    (req as any).rawBody = body;
    if (!body || (typeof body === 'string' && body.trim().length === 0)) {
      return done(null, {});
    }
    try {
      const json = JSON.parse(body as string);
      done(null, json);
    } catch (err: any) {
      done(err, undefined);
    }
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
  if (options.database && 'close' in options.database && typeof options.database.close === 'function') {
    const dbWithClose = options.database;
    app.addHook('onClose', async () => {
      await dbWithClose.close!();
    });
  }

  // Register health/readiness routes
  app.register(healthRoutes, {
    database: options.database as any
  });

  // Development / Test only: serve checkout-test.html
  if (config.NODE_ENV !== 'production') {
    app.get('/checkout-test.html', async (_request, reply) => {
      const candidates = [
        path.resolve(process.cwd(), 'checkout-test.html'),
        path.resolve(process.cwd(), '..', 'checkout-test.html'),
        path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', 'checkout-test.html')
      ];

      let htmlContent: string | null = null;
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          htmlContent = fs.readFileSync(candidate, 'utf8');
          break;
        }
      }

      if (!htmlContent) {
        return reply.status(404).send({
          error: {
            code: ErrorCodes.NOT_FOUND,
            message: 'checkout-test.html not found on disk'
          }
        });
      }

      return reply
        .header('Content-Type', 'text/html; charset=utf-8')
        .status(200)
        .send(htmlContent);
    });
  }

  // Resolve AuthVerifier (explicit option takes precedence, fallback to Supabase credentials if configured)
  let authVerifier = options.authVerifier;
  if (!authVerifier && config.SUPABASE_URL && (config.SUPABASE_PUBLISHABLE_KEY || config.SUPABASE_ANON_KEY)) {
    const supabaseKey = (config.SUPABASE_PUBLISHABLE_KEY || config.SUPABASE_ANON_KEY)!;
    authVerifier = new SupabaseAuthVerifier({
      supabaseUrl: config.SUPABASE_URL,
      supabaseKey
    });
  }

  // Resolve RazorpayClient (explicit option takes precedence, fallback to configured credentials)
  let razorpayClient = options.razorpayClient;
  if (!razorpayClient && config.RAZORPAY_KEY_ID && config.RAZORPAY_KEY_SECRET) {
    razorpayClient = new DefaultRazorpayClient({
      keyId: config.RAZORPAY_KEY_ID,
      keySecret: config.RAZORPAY_KEY_SECRET,
      webhookSecret: config.RAZORPAY_WEBHOOK_SECRET
    });
  }

  // Resolve N8nClient (explicit option takes precedence, fallback to configured webhook URL)
  let n8nClient = options.n8nClient;
  if (!n8nClient && config.N8N_APPU_WEBHOOK_URL) {
    n8nClient = new DefaultN8nClient({
      webhookUrl: config.N8N_APPU_WEBHOOK_URL
    });
  }

  // Register public plans route if database is available
  if (options.database) {
    app.register(plansRoutes, {
      db: options.database
    });
  }

  // Register protected routes if database and authVerifier are available
  if (options.database && authVerifier) {
    app.register(authRoutes, {
      db: options.database,
      authVerifier
    });

    app.register(householdRoutes, {
      db: options.database,
      authVerifier
    });

    app.register(childrenRoutes, {
      db: options.database,
      authVerifier
    });

    // Subscriptions and webhooks require RazorpayClient
    if (razorpayClient) {
      app.register(subscriptionsRoutes, {
        db: options.database,
        authVerifier,
        razorpayClient,
        razorpayKeyId: config.RAZORPAY_KEY_ID
      });

      app.register(webhooksRoutes, {
        db: options.database,
        razorpayClient
      });
    }

    // Appu AI Secure Gateway requires N8nClient
    if (n8nClient) {
      app.register(appuGatewayRoutes, {
        db: options.database,
        authVerifier,
        n8nClient
      });
    }
  }

  return app;
}
