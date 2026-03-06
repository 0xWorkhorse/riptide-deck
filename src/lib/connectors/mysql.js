import mysql from 'mysql2/promise';

/**
 * Create a MySQL connection and query data.
 */
export class MySQLConnector {
  constructor(config) {
    this.config = {
      host: config.host || 'localhost',
      port: config.port || 3306,
      database: config.database,
      user: config.user,
      password: config.password,
      connectTimeout: 10000,
    };
    this.connection = null;
  }

  async connect() {
    this.connection = await mysql.createConnection(this.config);
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
    const [rows] = await this.connection.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = ?
       ORDER BY table_name`,
      [this.config.database]
    );
    return rows.map((r) => ({
      schema: this.config.database,
      name: r.TABLE_NAME || r.table_name,
      fullName: `${this.config.database}.${r.TABLE_NAME || r.table_name}`,
    }));
  }

  async getColumns(table) {
    const tableName = table.includes('.') ? table.split('.').pop() : table;
    const [rows] = await this.connection.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = ? AND table_name = ?
       ORDER BY ordinal_position`,
      [this.config.database, tableName]
    );
    return rows.map((r) => ({
      name: r.COLUMN_NAME || r.column_name,
      type: r.DATA_TYPE || r.data_type,
      nullable: (r.IS_NULLABLE || r.is_nullable) === 'YES',
    }));
  }

  async query(tableOrQuery, options = {}) {
    let sql;
    if (tableOrQuery.trim().toLowerCase().startsWith('select')) {
      sql = tableOrQuery;
    } else {
      const where = options.where ? ` WHERE ${options.where}` : '';
      const limit = options.limit ? ` LIMIT ${options.limit}` : '';
      sql = `SELECT * FROM ${tableOrQuery}${where}${limit}`;
    }

    const [rows, fields] = await this.connection.query(sql);
    const columns = fields.map((f) => f.name);
    const mappedRows = rows.map((row, idx) => ({
      __rowIndex: idx,
      ...row,
    }));

    return {
      columns,
      rows: mappedRows,
      rowCount: mappedRows.length,
      sourceType: 'mysql',
      sourceName: tableOrQuery,
      queriedAt: new Date().toISOString(),
    };
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }
}
