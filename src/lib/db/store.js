import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = path.join(process.cwd(), '.data', 'riptide-deck.db');

let db = null;

function getDb() {
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

function initSchema(db) {
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

export function saveDataset(dataset) {
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

export function getDataset(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM datasets WHERE id = ?').get(id);
  if (!row) return null;
  return {
    ...row,
    columns: JSON.parse(row.columns),
    data: JSON.parse(row.data),
    metadata: row.metadata ? JSON.parse(row.metadata) : {},
  };
}

export function listDatasets() {
  const db = getDb();
  return db
    .prepare('SELECT id, name, source_type, source_name, columns, row_count, created_at FROM datasets ORDER BY created_at DESC')
    .all()
    .map((r) => ({ ...r, columns: JSON.parse(r.columns) }));
}

export function deleteDataset(id) {
  const db = getDb();
  db.prepare('DELETE FROM datasets WHERE id = ?').run(id);
}

// === Connections ===

export function saveConnection(conn) {
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

export function getConnection(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM connections WHERE id = ?').get(id);
}

export function deleteConnection(id) {
  const db = getDb();
  db.prepare('DELETE FROM connections WHERE id = ?').run(id);
}

// === Comparisons ===

export function saveComparison(comparison) {
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

export function getComparison(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM comparisons WHERE id = ?').get(id);
  if (!row) return null;
  return {
    ...row,
    config: JSON.parse(row.config),
    summary: row.summary ? JSON.parse(row.summary) : {},
  };
}

export function listComparisons() {
  const db = getDb();
  return db
    .prepare('SELECT id, name, source_a_id, source_b_id, summary, status, created_at, completed_at FROM comparisons ORDER BY created_at DESC')
    .all()
    .map((r) => ({ ...r, summary: r.summary ? JSON.parse(r.summary) : {} }));
}

export function deleteComparison(id) {
  const db = getDb();
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM exceptions WHERE comparison_id = ?').run(id);
    db.prepare('DELETE FROM comparisons WHERE id = ?').run(id);
  });
  transaction();
}

// === Exceptions ===

export function saveExceptions(comparisonId, exceptions) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO exceptions (id, comparison_id, status, key_value, key_values, source_a_data, source_b_data, differences, resolution, enriched_values)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((items) => {
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

export function getExceptions(comparisonId, filters = {}) {
  const db = getDb();
  let sql = 'SELECT * FROM exceptions WHERE comparison_id = ?';
  const params = [comparisonId];

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

  return db
    .prepare(sql)
    .all(...params)
    .map((r) => ({
      ...r,
      keyValues: r.key_values ? JSON.parse(r.key_values) : {},
      sourceA: r.source_a_data ? JSON.parse(r.source_a_data) : null,
      sourceB: r.source_b_data ? JSON.parse(r.source_b_data) : null,
      differences: r.differences ? JSON.parse(r.differences) : [],
      enrichedValues: r.enriched_values ? JSON.parse(r.enriched_values) : {},
    }));
}

export function getExceptionCounts(comparisonId) {
  const db = getDb();
  const rows = db
    .prepare('SELECT status, COUNT(*) as count FROM exceptions WHERE comparison_id = ? GROUP BY status')
    .all(comparisonId);
  const counts = { matched: 0, modified: 0, added: 0, removed: 0 };
  for (const r of rows) {
    counts[r.status] = r.count;
  }
  counts.total = Object.values(counts).reduce((a, b) => a + b, 0);
  return counts;
}

export function updateException(id, updates) {
  const db = getDb();
  const sets = [];
  const params = [];

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

export function bulkUpdateExceptions(ids, updates) {
  const db = getDb();
  const transaction = db.transaction(() => {
    for (const id of ids) {
      updateException(id, updates);
    }
  });
  transaction();
}
