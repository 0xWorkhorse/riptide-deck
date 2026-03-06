import pg from 'pg';

/**
 * Create a PostgreSQL connection and query data.
 */
export class PostgresConnector {
  constructor(config) {
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

  async connect() {
    this.pool = new pg.Pool(this.config);
    // Test the connection
    const client = await this.pool.connect();
    client.release();
    return true;
  }

  async testConnection() {
    try {
      await this.connect();
      await this.disconnect();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async getTables() {
    const result = await this.pool.query(`
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

  async getColumns(table) {
    const [schema, tableName] = table.includes('.')
      ? table.split('.')
      : ['public', table];

    const result = await this.pool.query(
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

  /**
   * Query a table and return structured dataset.
   * @param {string} tableOrQuery - Table name or raw SQL query
   * @param {object} options
   * @param {number} [options.limit] - Max rows
   * @param {string} [options.where] - WHERE clause (for table mode)
   * @returns {Promise<{ columns: string[], rows: object[], rowCount: number }>}
   */
  async query(tableOrQuery, options = {}) {
    let sql;
    if (tableOrQuery.trim().toLowerCase().startsWith('select')) {
      sql = tableOrQuery;
    } else {
      const where = options.where ? ` WHERE ${options.where}` : '';
      const limit = options.limit ? ` LIMIT ${options.limit}` : '';
      sql = `SELECT * FROM ${tableOrQuery}${where}${limit}`;
    }

    const result = await this.pool.query(sql);
    const columns = result.fields.map((f) => f.name);
    const rows = result.rows.map((row, idx) => ({
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

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}
