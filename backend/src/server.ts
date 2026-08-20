import { buildApp } from './app.js';
import { loadConfig } from './config/index.js';

async function startServer() {
  const config = loadConfig();
  const app = buildApp(config);

  try {
    const address = await app.listen({
      port: config.PORT,
      host: config.HOST
    });
    app.log.info(`[AppuBackend] Server listening at ${address} in ${config.NODE_ENV} mode`);
  } catch (err) {
    console.error('[AppuBackend] Failed to start server:', err);
    process.exit(1);
  }

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`[AppuBackend] Received ${signal}, shutting down gracefully...`);
      try {
        await app.close();
        app.log.info('[AppuBackend] Server closed cleanly');
        process.exit(0);
      } catch (err) {
        app.log.error({ err }, '[AppuBackend] Error during shutdown');
        process.exit(1);
      }
    });
  }
}

// Only start when invoked directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  startServer();
}

export { startServer };
