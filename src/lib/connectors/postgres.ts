import pg from 'pg';

export interface PostgresConfig {
  host?: string;
  port?: number;
  database: string;
  user?: string;
  password?: string;
  ssl?: boolean;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  sourceType: string;
  sourceName: string;
  queriedAt: string;
}

export interface QueryOptions {
  limit?: number;
  where?: string;
}

export class PostgresConnector {
  private config: pg.PoolConfig;
  private pool: pg.Pool | null;

  constructor(config: PostgresConfig) {
    this.config = {
      host: config.host || 'localhost',
      port: config.port || 5432,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl || false,
      connectionTimeoutMillis: 10000,
    };
    this.pool = null;
  }

  async connect(): Promise<boolean> {
    this.pool = new pg.Pool(this.config);
    // Test the connection
    const client = await this.pool.connect();
    client.release();
    return true;
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.connect();
      await this.disconnect();
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  async getTables(): Promise<Array<{ schema: string; name: string; fullName: string }>> {
    const result = await this.pool!.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name
    `);
    return result.rows.map((r) => ({
      schema: r.table_schema,
      name: r.table_name,
      fullName: `${r.table_schema}.${r.table_name}`,
    }));
  }

  async getColumns(table: string): Promise<Array<{ name: string; type: string; nullable: boolean }>> {
    const [schema, tableName] = table.includes('.')
      ? table.split('.')
      : ['public', table];

    const result = await this.pool!.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2
       ORDER BY ordinal_position`,
      [schema, tableName]
    );
    return result.rows.map((r) => ({
      name: r.column_name,
      type: r.data_type,
      nullable: r.is_nullable === 'YES',
    }));
  }

  async query(tableOrQuery: string, options: QueryOptions = {}): Promise<QueryResult> {
    let sql: string;
    if (tableOrQuery.trim().toLowerCase().startsWith('select')) {
      sql = tableOrQuery;
    } else {
      const where = options.where ? ` WHERE ${options.where}` : '';
      const limit = options.limit ? ` LIMIT ${options.limit}` : '';
      sql = `SELECT * FROM ${tableOrQuery}${where}${limit}`;
    }

    const result = await this.pool!.query(sql);
    const columns = result.fields.map((f) => f.name);
    const rows = result.rows.map((row: Record<string, unknown>, idx: number) => ({
      __rowIndex: idx,
      ...row,
    }));

    return {
      columns,
      rows,
      rowCount: rows.length,
      sourceType: 'postgres',
      sourceName: tableOrQuery,
      queriedAt: new Date().toISOString(),
    };
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}
