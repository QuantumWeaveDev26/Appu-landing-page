import pg from 'pg';
import type { Queryable, QueryResult, TransactionalQueryable } from './types.js';

const { Pool } = pg;

export interface DbConfig {
  connectionString?: string;
  maxConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export class PostgresDatabase implements TransactionalQueryable {
  public readonly pool: pg.Pool;

  constructor(config: DbConfig = {}) {
    const connectionString = config.connectionString?.trim() || process.env.DATABASE_URL?.trim();

    if (!connectionString) {
      throw new Error('DATABASE_URL or an explicit PostgreSQL connection string is required');
    }

    this.pool = new Pool({
      connectionString,
      max: config.maxConnections ?? 10,
      idleTimeoutMillis: config.idleTimeoutMillis ?? 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis ?? 5000
    });

    // Handle unexpected idle client errors
    this.pool.on('error', (err) => {
      console.error('[PostgresDatabase] Unexpected idle client error:', err);
    });
  }

  public async query<T extends pg.QueryResultRow = any>(queryText: string, values: any[] = []): Promise<QueryResult<T>> {
    const result = await this.pool.query<T>(queryText, values);
    return {
      rows: result.rows,
      rowCount: result.rowCount
    };
  }

  public async transaction<T>(work: (db: Queryable) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();

    const transactionDb: Queryable = {
      async query<TResult extends pg.QueryResultRow = any>(queryText: string, values: any[] = []) {
        const result = await client.query<TResult>(queryText, values);
        return {
          rows: result.rows,
          rowCount: result.rowCount
        };
      }
    };

    try {
      await client.query('BEGIN');
      const result = await work(transactionDb);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Safe readiness ping checking PostgreSQL connectivity.
   */
  public async isHealthy(): Promise<boolean> {
    try {
      const result = await this.pool.query('SELECT 1 AS healthy;');
      return result.rows.length > 0 && result.rows[0].healthy === 1;
    } catch {
      return false;
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

export function createDatabase(config?: DbConfig): PostgresDatabase {
  return new PostgresDatabase(config);
}
