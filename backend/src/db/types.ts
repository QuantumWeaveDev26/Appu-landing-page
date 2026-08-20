import type pg from 'pg';

export interface QueryResult<T extends pg.QueryResultRow = any> {
  rows: T[];
  rowCount: number | null;
}

export interface Queryable {
  query<T extends pg.QueryResultRow = any>(queryText: string, values?: any[]): Promise<QueryResult<T>>;
}

export interface TransactionalQueryable extends Queryable {
  transaction<T>(work: (db: Queryable) => Promise<T>): Promise<T>;
}
