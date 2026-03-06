import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = path.join(process.cwd(), '.data', 'riptide-deck.db');

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS datasets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_name TEXT,
      columns TEXT NOT NULL,
      row_count INTEGER NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      db_type TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      database_name TEXT NOT NULL,
      username TEXT,
      encrypted_password TEXT,
      ssl INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_used_at TEXT
    );

    CREATE TABLE IF NOT EXISTS comparisons (
      id TEXT PRIMARY KEY,
      name TEXT,
      source_a_id TEXT NOT NULL,
      source_b_id TEXT NOT NULL,
      config TEXT NOT NULL,
      summary TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (source_a_id) REFERENCES datasets(id),
      FOREIGN KEY (source_b_id) REFERENCES datasets(id)
    );

    CREATE TABLE IF NOT EXISTS exceptions (
      id TEXT PRIMARY KEY,
      comparison_id TEXT NOT NULL,
      status TEXT NOT NULL,
      key_value TEXT NOT NULL,
      key_values TEXT,
      source_a_data TEXT,
      source_b_data TEXT,
      differences TEXT,
      resolution TEXT,
      enriched_values TEXT DEFAULT '{}',
      resolved_by TEXT,
      resolved_at TEXT,
      FOREIGN KEY (comparison_id) REFERENCES comparisons(id)
    );

    CREATE INDEX IF NOT EXISTS idx_exceptions_comparison ON exceptions(comparison_id);
    CREATE INDEX IF NOT EXISTS idx_exceptions_status ON exceptions(status);
  `);
}

// === Datasets ===

export interface DatasetInput {
  name?: string;
  sourceName?: string;
  sourceType?: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  metadata?: Record<string, unknown>;
}

export function saveDataset(dataset: DatasetInput): string {
  const db = getDb();
  const id = uuidv4();
  db.prepare(`
    INSERT INTO datasets (id, name, source_type, source_name, columns, row_count, data, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    dataset.name || dataset.sourceName || 'Untitled',
    dataset.sourceType || 'file',
    dataset.sourceName || '',
    JSON.stringify(dataset.columns),
    dataset.rowCount,
    JSON.stringify(dataset.rows),
    JSON.stringify(dataset.metadata || {})
  );
  return id;
}

export function getDataset(id: string) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM datasets WHERE id = ?').get(id) as Record<string, string> | undefined;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    source_type: row.source_type,
    source_name: row.source_name,
    row_count: Number(row.row_count),
    created_at: row.created_at,
    columns: JSON.parse(row.columns) as string[],
    data: JSON.parse(row.data) as Record<string, unknown>[],
    metadata: row.metadata ? JSON.parse(row.metadata) : {},
  };
}

export function listDatasets() {
  const db = getDb();
  const rows = db
    .prepare('SELECT id, name, source_type, source_name, columns, row_count, created_at FROM datasets ORDER BY created_at DESC')
    .all() as Record<string, unknown>[];
  return rows.map((r) => ({ ...r, columns: JSON.parse(r.columns as string) }));
}

export function deleteDataset(id: string) {
  const db = getDb();
  db.prepare('DELETE FROM datasets WHERE id = ?').run(id);
}

// === Connections ===

export interface ConnectionInput {
  id?: string;
  name: string;
  dbType: string;
  host: string;
  port: number;
  database: string;
  username?: string;
  password?: string;
  ssl?: boolean;
}

export function saveConnection(conn: ConnectionInput): string {
  const db = getDb();
  const id = conn.id || uuidv4();
  db.prepare(`
    INSERT OR REPLACE INTO connections (id, name, db_type, host, port, database_name, username, encrypted_password, ssl)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    conn.name,
    conn.dbType,
    conn.host,
    conn.port,
    conn.database,
    conn.username || '',
    conn.password || '', // In production: encrypt this
    conn.ssl ? 1 : 0
  );
  return id;
}

export function listConnections() {
  const db = getDb();
  return db
    .prepare('SELECT id, name, db_type, host, port, database_name, username, ssl, created_at, last_used_at FROM connections ORDER BY created_at DESC')
    .all();
}

export function getConnection(id: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM connections WHERE id = ?').get(id) as Record<string, unknown> | undefined;
}

export function deleteConnection(id: string) {
  const db = getDb();
  db.prepare('DELETE FROM connections WHERE id = ?').run(id);
}

// === Comparisons ===

export interface ComparisonInput {
  id?: string;
  name?: string;
  sourceAId: string;
  sourceBId: string;
  config: Record<string, unknown>;
  summary?: Record<string, unknown>;
  status?: string;
}

export function saveComparison(comparison: ComparisonInput): string {
  const db = getDb();
  const id = comparison.id || uuidv4();
  db.prepare(`
    INSERT INTO comparisons (id, name, source_a_id, source_b_id, config, summary, status, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    comparison.name || 'Untitled Comparison',
    comparison.sourceAId,
    comparison.sourceBId,
    JSON.stringify(comparison.config),
    JSON.stringify(comparison.summary || {}),
    comparison.status || 'completed',
    new Date().toISOString()
  );
  return id;
}

export function getComparison(id: string) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM comparisons WHERE id = ?').get(id) as Record<string, string> | undefined;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    source_a_id: row.source_a_id,
    source_b_id: row.source_b_id,
    status: row.status,
    created_at: row.created_at,
    completed_at: row.completed_at,
    config: JSON.parse(row.config) as Record<string, unknown>,
    summary: row.summary ? JSON.parse(row.summary) as Record<string, number> : {},
  };
}

export function listComparisons() {
  const db = getDb();
  const rows = db
    .prepare('SELECT id, name, source_a_id, source_b_id, summary, status, created_at, completed_at FROM comparisons ORDER BY created_at DESC')
    .all() as Record<string, unknown>[];
  return rows.map((r) => ({ ...r, summary: r.summary ? JSON.parse(r.summary as string) : {} }));
}

export function deleteComparison(id: string) {
  const db = getDb();
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM exceptions WHERE comparison_id = ?').run(id);
    db.prepare('DELETE FROM comparisons WHERE id = ?').run(id);
  });
  transaction();
}

// === Exceptions ===

export interface ExceptionInput {
  id: string;
  status: string;
  key: string;
  keyValues?: Record<string, unknown>;
  sourceA?: Record<string, unknown> | null;
  sourceB?: Record<string, unknown> | null;
  differences?: Array<{ column: string; valueA: unknown; valueB: unknown }>;
  resolution?: string | null;
  enrichedValues?: Record<string, unknown>;
}

export function saveExceptions(comparisonId: string, exceptions: ExceptionInput[]) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO exceptions (id, comparison_id, status, key_value, key_values, source_a_data, source_b_data, differences, resolution, enriched_values)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((items: ExceptionInput[]) => {
    for (const ex of items) {
      stmt.run(
        ex.id,
        comparisonId,
        ex.status,
        ex.key,
        JSON.stringify(ex.keyValues || {}),
        ex.sourceA ? JSON.stringify(ex.sourceA) : null,
        ex.sourceB ? JSON.stringify(ex.sourceB) : null,
        JSON.stringify(ex.differences || []),
        ex.resolution,
        JSON.stringify(ex.enrichedValues || {})
      );
    }
  });

  transaction(exceptions);
}

export interface ExceptionFilters {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export function getExceptions(comparisonId: string, filters: ExceptionFilters = {}) {
  const db = getDb();
  let sql = 'SELECT * FROM exceptions WHERE comparison_id = ?';
  const params: (string | number)[] = [comparisonId];

  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }

  if (filters.search) {
    sql += ' AND (key_value LIKE ? OR source_a_data LIKE ? OR source_b_data LIKE ?)';
    const term = `%${filters.search}%`;
    params.push(term, term, term);
  }

  sql += ' ORDER BY status, key_value';

  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }
  if (filters.offset) {
    sql += ' OFFSET ?';
    params.push(filters.offset);
  }

  const rows = db
    .prepare(sql)
    .all(...params) as Record<string, unknown>[];
  return rows.map((r) => ({
      ...r,
      keyValues: r.key_values ? JSON.parse(r.key_values as string) : {},
      sourceA: r.source_a_data ? JSON.parse(r.source_a_data as string) : null,
      sourceB: r.source_b_data ? JSON.parse(r.source_b_data as string) : null,
      differences: r.differences ? JSON.parse(r.differences as string) : [],
      enrichedValues: r.enriched_values ? JSON.parse(r.enriched_values as string) : {},
    }));
}

export function getExceptionCounts(comparisonId: string) {
  const db = getDb();
  const rows = db
    .prepare('SELECT status, COUNT(*) as count FROM exceptions WHERE comparison_id = ? GROUP BY status')
    .all(comparisonId) as Array<{ status: string; count: number }>;
  const counts: Record<string, number> = { matched: 0, modified: 0, added: 0, removed: 0 };
  for (const r of rows) {
    counts[r.status] = r.count;
  }
  counts.total = Object.values(counts).reduce((a, b) => a + b, 0);
  return counts;
}

export interface ExceptionUpdates {
  status?: string;
  resolution?: string;
  enrichedValues?: Record<string, unknown>;
  resolvedBy?: string;
}

export function updateException(id: string, updates: ExceptionUpdates) {
  const db = getDb();
  const sets: string[] = [];
  const params: (string | number)[] = [];

  if (updates.status !== undefined) {
    sets.push('status = ?');
    params.push(updates.status);
  }
  if (updates.resolution !== undefined) {
    sets.push('resolution = ?');
    params.push(updates.resolution);
  }
  if (updates.enrichedValues !== undefined) {
    sets.push('enriched_values = ?');
    params.push(JSON.stringify(updates.enrichedValues));
  }
  if (updates.resolvedBy !== undefined) {
    sets.push('resolved_by = ?');
    params.push(updates.resolvedBy);
  }

  if (sets.length > 0) {
    sets.push('resolved_at = ?');
    params.push(new Date().toISOString());
    params.push(id);
    db.prepare(`UPDATE exceptions SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }
}

export function bulkUpdateExceptions(ids: string[], updates: ExceptionUpdates) {
  const db = getDb();
  const transaction = db.transaction(() => {
    for (const id of ids) {
      updateException(id, updates);
    }
  });
  transaction();
}
