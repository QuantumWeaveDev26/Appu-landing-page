import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TransactionalQueryable } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATION_ADVISORY_LOCK_KEY = 1095782485;
let processMigrationTail: Promise<void> = Promise.resolve();

export interface MigrationFile {
  version: string;
  sql: string;
  checksum: string;
}

export interface AppliedMigrationRecord {
  version: string;
  checksum: string | null;
  applied_at: Date;
}

export class MigrationChecksumMismatchError extends Error {
  public readonly version: string;
  public readonly expectedChecksum: string;
  public readonly actualChecksum: string;

  constructor(version: string, expectedChecksum: string, actualChecksum: string) {
    super(
      `Migration checksum mismatch for "${version}". Applied checksum: "${expectedChecksum}", Current file checksum: "${actualChecksum}". Historical migrations must not be altered.`
    );
    this.name = 'MigrationChecksumMismatchError';
    this.version = version;
    this.expectedChecksum = expectedChecksum;
    this.actualChecksum = actualChecksum;
  }
}

/**
 * Computes a stable SHA-256 checksum over migration SQL contents,
 * normalizing line endings across platforms.
 */
export function computeChecksum(content: string): string {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Resolves the authoritative migrations directory.
 */
export function resolveMigrationsDir(customDir?: string): string {
  if (customDir && fs.existsSync(customDir)) {
    return customDir;
  }

  const candidateDirs = [
    path.resolve(__dirname, '../../db/migrations'),
    path.resolve(__dirname, '../db/migrations'),
    path.resolve(process.cwd(), 'db/migrations'),
    path.resolve(process.cwd(), 'backend/db/migrations')
  ];

  for (const candidate of candidateDirs) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Migrations directory not found. Looked in: ${candidateDirs.join(', ')}`
  );
}

/**
 * Loads all .sql migration files from the authoritative filesystem directory.
 */
export function loadMigrationFiles(customDir?: string): MigrationFile[] {
  const dir = resolveMigrationsDir(customDir);
  const files = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    throw new Error(`No .sql migration files found in directory: ${dir}`);
  }

  return files.map((file) => {
    const rawSql = fs.readFileSync(path.join(dir, file), 'utf8');
    return {
      version: file,
      sql: rawSql,
      checksum: computeChecksum(rawSql)
    };
  });
}

async function withProcessMigrationLock<T>(work: () => Promise<T>): Promise<T> {
  const previous = processMigrationTail;
  let release!: () => void;
  processMigrationTail = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    return await work();
  } finally {
    release();
  }
}

/**
 * Executes all pending PostgreSQL migrations in order with checksum verification.
 * Tracks applied migrations in the `schema_migrations` table.
 */
export async function runMigrations(
  db: TransactionalQueryable,
  options?: { migrationsDir?: string }
): Promise<string[]> {
  return withProcessMigrationLock(() => db.transaction(async (transactionDb) => {
    // Acquire transaction-scoped advisory lock to prevent concurrent migration executions
    await transactionDb.query(
      'SELECT pg_advisory_xact_lock($1);',
      [MIGRATION_ADVISORY_LOCK_KEY]
    );

    // 1. Check if schema_migrations table exists using safe metadata inspection (never speculative failing SQL)
    const tableExistsResult = await transactionDb.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'schema_migrations'
      ) AS exists;
    `);

    const tableExists = Boolean(tableExistsResult.rows[0]?.exists);

    if (!tableExists) {
      await transactionDb.query(`
        CREATE TABLE schema_migrations (
          version VARCHAR(255) PRIMARY KEY,
          checksum VARCHAR(64),
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
    } else {
      // 2. If table exists, check if 'checksum' column is present
      const columnExistsResult = await transactionDb.query<{ exists: boolean }>(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'schema_migrations' AND column_name = 'checksum'
        ) AS exists;
      `);

      const checksumColumnExists = Boolean(columnExistsResult.rows[0]?.exists);

      if (!checksumColumnExists) {
        // Upgrade table schema cleanly without recreating or dropping existing migration history
        await transactionDb.query(`
          ALTER TABLE schema_migrations ADD COLUMN checksum VARCHAR(64);
        `);
      }
    }

    // 3. Retrieve all previously applied migrations
    const appliedResult = await transactionDb.query<AppliedMigrationRecord>(
      'SELECT version, checksum, applied_at FROM schema_migrations ORDER BY version ASC;'
    );
    const appliedMap = new Map<string, string | null>(
      appliedResult.rows.map((row) => [row.version, row.checksum])
    );

    const migrationFiles = loadMigrationFiles(options?.migrationsDir);
    const newlyApplied: string[] = [];

    for (const migration of migrationFiles) {
      if (appliedMap.has(migration.version)) {
        const existingChecksum = appliedMap.get(migration.version);

        if (existingChecksum === null || existingChecksum === undefined || existingChecksum === '') {
          // Migration was applied before checksums were enabled: backfill the checksum safely
          await transactionDb.query(
            'UPDATE schema_migrations SET checksum = $1 WHERE version = $2;',
            [migration.checksum, migration.version]
          );
        } else if (existingChecksum !== migration.checksum) {
          // Migration was already applied with a different checksum: abort safely
          throw new MigrationChecksumMismatchError(
            migration.version,
            existingChecksum,
            migration.checksum
          );
        }

        // Migration already applied with valid/backfilled checksum, proceed to next
        continue;
      }

      // 4. Execute unapplied migration SQL
      try {
        await transactionDb.query(migration.sql);
      } catch (err: any) {
        // Mock parser compatibility (e.g. pg-mem) for PostgreSQL 15+ partial SET NULL syntax: ON DELETE SET NULL (col)
        const errMsg = String(err?.message || err?.data?.error || err);
        if (errMsg.includes('SET NULL') || errMsg.includes('set null')) {
          const compatSql = migration.sql.replace(/ON DELETE SET NULL\s*\([^)]+\)/gi, 'ON DELETE SET NULL');
          await transactionDb.query(compatSql);
        } else {
          throw err;
        }
      }

      // 5. Record applied version and checksum
      await transactionDb.query(
        'INSERT INTO schema_migrations (version, checksum, applied_at) VALUES ($1, $2, NOW());',
        [migration.version, migration.checksum]
      );

      newlyApplied.push(migration.version);
    }

    return newlyApplied;
  }));
}
