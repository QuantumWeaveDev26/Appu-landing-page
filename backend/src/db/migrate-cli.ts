import { createDatabase } from './client.js';
import { runMigrations, MigrationChecksumMismatchError } from './migrator.js';
import { loadConfig } from '../config/index.js';

export async function runMigrateCli(): Promise<void> {
  console.log('[Migration] Starting database migration...');

  let config;
  try {
    config = loadConfig();
  } catch (err: any) {
    console.error('[Migration] Failed to load configuration:', err.message);
    process.exit(1);
  }

  if (!config.DATABASE_URL) {
    console.error(
      '[Migration] ERROR: DATABASE_URL is not set. Please provide DATABASE_URL in the environment to run migrations.'
    );
    process.exit(1);
  }

  const db = createDatabase({ connectionString: config.DATABASE_URL });

  try {
    const applied = await runMigrations(db);

    if (applied.length === 0) {
      console.log('[Migration] Database is already up to date. No pending migrations.');
    } else {
      console.log(`[Migration] Successfully applied ${applied.length} migration(s):`);
      for (const version of applied) {
        console.log(`  ✓ ${version}`);
      }
    }
  } catch (err: any) {
    if (err instanceof MigrationChecksumMismatchError) {
      console.error(`[Migration] INTEGRITY ERROR: ${err.message}`);
    } else {
      console.error('[Migration] Failed to apply migrations:', err.message);
    }
    await db.close().catch(() => {});
    process.exit(1);
  }

  await db.close();
  console.log('[Migration] Migration complete.');
}

// Execute when invoked directly
if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('migrate-cli.ts') ||
  process.argv[1]?.endsWith('migrate-cli.js')
) {
  runMigrateCli();
}
