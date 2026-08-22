import { buildApp } from './app.js';
import { loadConfig } from './config/index.js';
import { createDatabase, type PostgresDatabase } from './db/client.js';

async function startServer() {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '0.0.0.0';

  console.log(`[AppuBackend] Server startup initiated (host=${host}, port=${port})...`);

  const config = loadConfig();

  let database: PostgresDatabase | undefined;
  if (config.DATABASE_URL) {
    try {
      database = createDatabase({ connectionString: config.DATABASE_URL });
    } catch (err: any) {
      console.error('[AppuBackend] Failed to initialize database pool:', err.message);
      process.exit(1);
    }
  }

  const app = buildApp(config, { database });

  try {
    const address = await app.listen({ port, host });
    console.log(`[AppuBackend] Server listening successfully at ${address} in ${config.NODE_ENV} mode`);
    app.log.info(`[AppuBackend] Server listening at ${address} in ${config.NODE_ENV} mode`);
  } catch (err: any) {
    console.error('[AppuBackend] Failed to start server:', err?.message || err);
    if (database) {
      await database.close().catch(() => {});
    }
    process.exit(1);
  }

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`[AppuBackend] Received ${signal}, shutting down gracefully...`);
      try {
        await app.close();
        if (database) {
          await database.close().catch(() => {});
        }
        app.log.info('[AppuBackend] Server closed cleanly');
        process.exit(0);
      } catch (err) {
        app.log.error({ err }, '[AppuBackend] Error during shutdown');
        process.exit(1);
      }
    });
  }
}

// Unconditional startup invocation when file is loaded/imported as Hostinger entry file
startServer().catch((err) => {
  console.error('[AppuBackend] Unhandled error during startup:', err);
  process.exit(1);
});

export { startServer };

