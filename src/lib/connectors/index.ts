import { PostgresConnector } from './postgres';
import { MySQLConnector } from './mysql';

type ConnectorClass = typeof PostgresConnector | typeof MySQLConnector;

const CONNECTOR_TYPES: Record<string, ConnectorClass> = {
  postgres: PostgresConnector,
  postgresql: PostgresConnector,
  mysql: MySQLConnector,
  mariadb: MySQLConnector,
};

export function createConnector(type: string, config: Record<string, unknown>): PostgresConnector | MySQLConnector {
  const ConnectorClass = CONNECTOR_TYPES[type.toLowerCase()];
  if (!ConnectorClass) {
    throw new Error(
      `Unsupported database type: ${type}. Supported: ${Object.keys(CONNECTOR_TYPES).join(', ')}`
    );
  }
  return new ConnectorClass(config as never);
}

export const SUPPORTED_DB_TYPES = [
  { value: 'postgres', label: 'PostgreSQL', defaultPort: 5432 },
  { value: 'mysql', label: 'MySQL / MariaDB', defaultPort: 3306 },
];

export { PostgresConnector, MySQLConnector };
