import { PostgresConnector } from './postgres.js';
import { MySQLConnector } from './mysql.js';

const CONNECTOR_TYPES = {
  postgres: PostgresConnector,
  postgresql: PostgresConnector,
  mysql: MySQLConnector,
  mariadb: MySQLConnector,
};

/**
 * Create a database connector by type.
 * @param {string} type - 'postgres', 'mysql', etc.
 * @param {object} config - Connection config
 * @returns {PostgresConnector|MySQLConnector}
 */
export function createConnector(type, config) {
  const ConnectorClass = CONNECTOR_TYPES[type.toLowerCase()];
  if (!ConnectorClass) {
    throw new Error(
      `Unsupported database type: ${type}. Supported: ${Object.keys(CONNECTOR_TYPES).join(', ')}`
    );
  }
  return new ConnectorClass(config);
}

export const SUPPORTED_DB_TYPES = [
  { value: 'postgres', label: 'PostgreSQL', defaultPort: 5432 },
  { value: 'mysql', label: 'MySQL / MariaDB', defaultPort: 3306 },
];

export { PostgresConnector, MySQLConnector };
