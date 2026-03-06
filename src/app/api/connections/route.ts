import { NextResponse, NextRequest } from 'next/server';
import { createConnector } from '@/lib/connectors/index';
import {
  saveConnection,
  listConnections,
  getConnection,
  deleteConnection,
  saveDataset,
} from '@/lib/db/store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Test connection
    if (action === 'test') {
      const connector = createConnector(body.dbType, {
        host: body.host,
        port: body.port,
        database: body.database,
        user: body.username,
        password: body.password,
        ssl: body.ssl,
      });
      const result = await connector.testConnection();
      return NextResponse.json(result);
    }

    // Fetch tables from a connection
    if (action === 'tables') {
      const conn = body.connectionId ? getConnection(body.connectionId) : body;
      const config = body.connectionId
        ? {
            host: conn!.host as string,
            port: conn!.port as number,
            database: conn!.database_name as string,
            user: conn!.username as string,
            password: conn!.encrypted_password as string,
            ssl: conn!.ssl as boolean,
          }
        : {
            host: body.host,
            port: body.port,
            database: body.database,
            user: body.username,
            password: body.password,
            ssl: body.ssl,
          };

      const connector = createConnector((conn?.db_type as string) || body.dbType, config);
      await connector.connect();
      const tables = await connector.getTables();
      await connector.disconnect();
      return NextResponse.json({ tables });
    }

    // Fetch columns for a table
    if (action === 'columns') {
      const conn = getConnection(body.connectionId);
      if (!conn) return NextResponse.json({ error: 'Connection not found' }, { status: 404 });

      const connector = createConnector(conn.db_type as string, {
        host: conn.host,
        port: conn.port,
        database: conn.database_name,
        user: conn.username,
        password: conn.encrypted_password,
        ssl: conn.ssl,
      });
      await connector.connect();
      const columns = await connector.getColumns(body.table);
      await connector.disconnect();
      return NextResponse.json({ columns });
    }

    // Query and import data
    if (action === 'query') {
      const conn = getConnection(body.connectionId);
      if (!conn) return NextResponse.json({ error: 'Connection not found' }, { status: 404 });

      const connector = createConnector(conn.db_type as string, {
        host: conn.host,
        port: conn.port,
        database: conn.database_name,
        user: conn.username,
        password: conn.encrypted_password,
        ssl: conn.ssl,
      });
      await connector.connect();
      const result = await connector.query(body.table || body.query, {
        limit: body.limit,
        where: body.where,
      });
      await connector.disconnect();

      // Save as dataset
      const datasetId = saveDataset({
        name: body.name || `${conn.name}: ${body.table || 'query'}`,
        sourceType: conn.db_type as string,
        sourceName: `${conn.host}/${conn.database_name}/${body.table || 'query'}`,
        columns: result.columns,
        rows: result.rows,
        rowCount: result.rowCount,
      });

      return NextResponse.json({
        datasetId,
        columns: result.columns,
        rowCount: result.rowCount,
        preview: result.rows.slice(0, 5),
      });
    }

    // Save connection
    const id = saveConnection(body);
    return NextResponse.json({ id, success: true });
  } catch (err) {
    console.error('Connection error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET() {
  const connections = listConnections();
  return NextResponse.json({ connections });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  deleteConnection(id);
  return NextResponse.json({ success: true });
}
