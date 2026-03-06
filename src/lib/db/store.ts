import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = path.join(process.cwd(), '.data', 'riptide-deck.db');

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
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

    -- === Songs (Story to Splits) ===
    CREATE TABLE IF NOT EXISTS songs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      artist TEXT,
      album TEXT,
      record_label TEXT,
      iswc TEXT,
      bmi_id TEXT,
      ascap_id TEXT,
      mlc_id TEXT,
      is_instrumental INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      source_type TEXT NOT NULL DEFAULT 'story',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contributors (
      id TEXT PRIMARY KEY,
      song_id TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'songwriter',
      ipi TEXT,
      pro TEXT,
      split_percent REAL DEFAULT 0,
      split_type TEXT DEFAULT 'music',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (song_id) REFERENCES songs(id)
    );

    CREATE INDEX IF NOT EXISTS idx_contributors_song ON contributors(song_id);

    -- === Documents (Document to Splits) ===
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_name TEXT,
      song_count INTEGER DEFAULT 0,
      raw_data TEXT,
      parsed_songs TEXT,
      status TEXT NOT NULL DEFAULT 'parsed',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS document_songs (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      title TEXT NOT NULL,
      artist TEXT,
      iswc TEXT,
      bmi_id TEXT,
      ascap_id TEXT,
      mlc_id TEXT,
      contributors TEXT NOT NULL DEFAULT '[]',
      publishers TEXT NOT NULL DEFAULT '[]',
      raw_data TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (document_id) REFERENCES documents(id)
    );

    CREATE INDEX IF NOT EXISTS idx_document_songs_document ON document_songs(document_id);

    CREATE TABLE IF NOT EXISTS song_external_refs (
      id TEXT PRIMARY KEY,
      document_song_id TEXT NOT NULL,
      source TEXT NOT NULL,
      external_id TEXT,
      external_data TEXT NOT NULL DEFAULT '{}',
      match_status TEXT NOT NULL DEFAULT 'pending',
      matched_title TEXT,
      confidence REAL DEFAULT 0,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (document_song_id) REFERENCES document_songs(id)
    );

    CREATE INDEX IF NOT EXISTS idx_external_refs_song ON song_external_refs(document_song_id);
    CREATE INDEX IF NOT EXISTS idx_external_refs_source ON song_external_refs(source);
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

// === Songs ===

export interface SongInput {
  title: string;
  artist?: string;
  album?: string;
  recordLabel?: string;
  iswc?: string;
  bmiId?: string;
  ascapId?: string;
  mlcId?: string;
  isInstrumental?: boolean;
  status?: string;
  sourceType?: string;
  notes?: string;
}

export interface ContributorInput {
  name: string;
  role: string;
  ipi?: string;
  pro?: string;
  splitPercent?: number;
  splitType?: string;
}

export function saveSong(song: SongInput, contributors: ContributorInput[]): string {
  const db = getDb();
  const id = uuidv4();
  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO songs (id, title, artist, album, record_label, iswc, bmi_id, ascap_id, mlc_id, is_instrumental, status, source_type, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      song.title,
      song.artist || null,
      song.album || null,
      song.recordLabel || null,
      song.iswc || null,
      song.bmiId || null,
      song.ascapId || null,
      song.mlcId || null,
      song.isInstrumental ? 1 : 0,
      song.status || 'draft',
      song.sourceType || 'story',
      song.notes || null,
    );

    const contribStmt = db.prepare(`
      INSERT INTO contributors (id, song_id, name, role, ipi, pro, split_percent, split_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const c of contributors) {
      contribStmt.run(
        uuidv4(),
        id,
        c.name,
        c.role,
        c.ipi || null,
        c.pro || null,
        c.splitPercent ?? 0,
        c.splitType || 'music',
      );
    }
  });
  transaction();
  return id;
}

export function getSong(id: string) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM songs WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  const contributors = db.prepare('SELECT * FROM contributors WHERE song_id = ? ORDER BY split_percent DESC').all(id) as Record<string, unknown>[];
  return {
    id: row.id as string,
    title: row.title as string,
    artist: row.artist as string | null,
    album: row.album as string | null,
    record_label: row.record_label as string | null,
    iswc: row.iswc as string | null,
    bmi_id: row.bmi_id as string | null,
    ascap_id: row.ascap_id as string | null,
    mlc_id: row.mlc_id as string | null,
    is_instrumental: Boolean(row.is_instrumental),
    status: row.status as string,
    source_type: row.source_type as string,
    notes: row.notes as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    contributors: contributors.map((c) => ({
      id: c.id as string,
      name: c.name as string,
      role: c.role as string,
      ipi: c.ipi as string | null,
      pro: c.pro as string | null,
      split_percent: c.split_percent as number,
      split_type: c.split_type as string,
    })),
  };
}

export function listSongs(filters: { search?: string; status?: string } = {}) {
  const db = getDb();
  let sql = 'SELECT * FROM songs';
  const params: string[] = [];
  const conditions: string[] = [];

  if (filters.search) {
    conditions.push('(title LIKE ? OR artist LIKE ? OR album LIKE ?)');
    const term = `%${filters.search}%`;
    params.push(term, term, term);
  }
  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY created_at DESC';

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: row.id as string,
    title: row.title as string,
    artist: row.artist as string | null,
    album: row.album as string | null,
    record_label: row.record_label as string | null,
    is_instrumental: Boolean(row.is_instrumental),
    status: row.status as string,
    source_type: row.source_type as string,
    created_at: row.created_at as string,
  }));
}

export function updateSong(id: string, updates: Partial<SongInput>) {
  const db = getDb();
  const sets: string[] = [];
  const params: (string | number | null)[] = [];

  const fieldMap: Record<string, string> = {
    title: 'title',
    artist: 'artist',
    album: 'album',
    recordLabel: 'record_label',
    iswc: 'iswc',
    bmiId: 'bmi_id',
    ascapId: 'ascap_id',
    mlcId: 'mlc_id',
    status: 'status',
    notes: 'notes',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in updates) {
      sets.push(`${col} = ?`);
      params.push((updates as Record<string, string | null>)[key] ?? null);
    }
  }
  if (updates.isInstrumental !== undefined) {
    sets.push('is_instrumental = ?');
    params.push(updates.isInstrumental ? 1 : 0);
  }

  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE songs SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }
}

export function updateSongContributors(songId: string, contributors: ContributorInput[]) {
  const db = getDb();
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM contributors WHERE song_id = ?').run(songId);
    const stmt = db.prepare(`
      INSERT INTO contributors (id, song_id, name, role, ipi, pro, split_percent, split_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const c of contributors) {
      stmt.run(
        uuidv4(),
        songId,
        c.name,
        c.role,
        c.ipi || null,
        c.pro || null,
        c.splitPercent ?? 0,
        c.splitType || 'music',
      );
    }
  });
  transaction();
}

export function deleteSong(id: string) {
  const db = getDb();
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM contributors WHERE song_id = ?').run(id);
    db.prepare('DELETE FROM songs WHERE id = ?').run(id);
  });
  transaction();
}

// === Documents ===

export interface DocumentInput {
  name: string;
  fileType: string;
  fileName?: string;
  songCount?: number;
  rawData?: string;
  parsedSongs?: unknown[];
}

export function saveDocument(doc: DocumentInput): string {
  const db = getDb();
  const id = uuidv4();
  db.prepare(`
    INSERT INTO documents (id, name, file_type, file_name, song_count, raw_data, parsed_songs, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'parsed')
  `).run(
    id,
    doc.name,
    doc.fileType,
    doc.fileName || null,
    doc.songCount || 0,
    doc.rawData || null,
    JSON.stringify(doc.parsedSongs || []),
  );
  return id;
}

export interface DocumentSongInput {
  title: string;
  artist?: string;
  iswc?: string;
  bmiId?: string;
  ascapId?: string;
  mlcId?: string;
  contributors: Array<{ name: string; role: string; ipi?: string; pro?: string; share?: number }>;
  publishers: Array<{ name: string; role: string; ipi?: string; pro?: string; share?: number }>;
  rawData?: Record<string, unknown>;
}

export function saveDocumentSongs(documentId: string, songs: DocumentSongInput[]): string[] {
  const db = getDb();
  const ids: string[] = [];
  const stmt = db.prepare(`
    INSERT INTO document_songs (id, document_id, title, artist, iswc, bmi_id, ascap_id, mlc_id, contributors, publishers, raw_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    for (const song of songs) {
      const id = uuidv4();
      ids.push(id);
      stmt.run(
        id,
        documentId,
        song.title,
        song.artist || null,
        song.iswc || null,
        song.bmiId || null,
        song.ascapId || null,
        song.mlcId || null,
        JSON.stringify(song.contributors),
        JSON.stringify(song.publishers),
        JSON.stringify(song.rawData || {}),
      );
    }
  });
  transaction();

  db.prepare('UPDATE documents SET song_count = ? WHERE id = ?').run(songs.length, documentId);
  return ids;
}

export function getDocument(id: string) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;

  const songs = db.prepare('SELECT * FROM document_songs WHERE document_id = ? ORDER BY title').all(id) as Record<string, unknown>[];

  return {
    id: row.id as string,
    name: row.name as string,
    file_type: row.file_type as string,
    file_name: row.file_name as string | null,
    song_count: row.song_count as number,
    status: row.status as string,
    created_at: row.created_at as string,
    songs: songs.map((s) => ({
      id: s.id as string,
      title: s.title as string,
      artist: s.artist as string | null,
      iswc: s.iswc as string | null,
      bmi_id: s.bmi_id as string | null,
      ascap_id: s.ascap_id as string | null,
      mlc_id: s.mlc_id as string | null,
      contributors: JSON.parse(s.contributors as string) as Array<{ name: string; role: string; ipi?: string; pro?: string; share?: number }>,
      publishers: JSON.parse(s.publishers as string) as Array<{ name: string; role: string; ipi?: string; pro?: string; share?: number }>,
      raw_data: JSON.parse(s.raw_data as string) as Record<string, unknown>,
    })),
  };
}

export function listDocuments() {
  const db = getDb();
  const rows = db.prepare('SELECT id, name, file_type, file_name, song_count, status, created_at FROM documents ORDER BY created_at DESC').all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    file_type: row.file_type as string,
    file_name: row.file_name as string | null,
    song_count: row.song_count as number,
    status: row.status as string,
    created_at: row.created_at as string,
  }));
}

export function getDocumentSong(id: string) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM document_songs WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;

  const refs = db.prepare('SELECT * FROM song_external_refs WHERE document_song_id = ? ORDER BY source').all(id) as Record<string, unknown>[];

  return {
    id: row.id as string,
    document_id: row.document_id as string,
    title: row.title as string,
    artist: row.artist as string | null,
    iswc: row.iswc as string | null,
    bmi_id: row.bmi_id as string | null,
    ascap_id: row.ascap_id as string | null,
    mlc_id: row.mlc_id as string | null,
    contributors: JSON.parse(row.contributors as string) as Array<{ name: string; role: string; ipi?: string; pro?: string; share?: number }>,
    publishers: JSON.parse(row.publishers as string) as Array<{ name: string; role: string; ipi?: string; pro?: string; share?: number }>,
    raw_data: JSON.parse(row.raw_data as string) as Record<string, unknown>,
    external_refs: refs.map((r) => ({
      id: r.id as string,
      source: r.source as string,
      external_id: r.external_id as string | null,
      external_data: JSON.parse(r.external_data as string) as Record<string, unknown>,
      match_status: r.match_status as string,
      matched_title: r.matched_title as string | null,
      confidence: r.confidence as number,
      fetched_at: r.fetched_at as string,
    })),
  };
}

export function updateDocumentSong(id: string, updates: Partial<{
  title: string;
  artist: string;
  iswc: string;
  bmiId: string;
  ascapId: string;
  mlcId: string;
  contributors: Array<{ name: string; role: string; ipi?: string; pro?: string; share?: number }>;
  publishers: Array<{ name: string; role: string; ipi?: string; pro?: string; share?: number }>;
}>) {
  const db = getDb();
  const sets: string[] = [];
  const params: (string | null)[] = [];

  const fieldMap: Record<string, string> = {
    title: 'title',
    artist: 'artist',
    iswc: 'iswc',
    bmiId: 'bmi_id',
    ascapId: 'ascap_id',
    mlcId: 'mlc_id',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in updates) {
      sets.push(`${col} = ?`);
      params.push((updates as Record<string, string | null>)[key] ?? null);
    }
  }
  if (updates.contributors !== undefined) {
    sets.push('contributors = ?');
    params.push(JSON.stringify(updates.contributors));
  }
  if (updates.publishers !== undefined) {
    sets.push('publishers = ?');
    params.push(JSON.stringify(updates.publishers));
  }

  if (sets.length > 0) {
    params.push(id);
    db.prepare(`UPDATE document_songs SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }
}

export interface ExternalRefInput {
  documentSongId: string;
  source: string;
  externalId?: string;
  externalData: Record<string, unknown>;
  matchStatus: string;
  matchedTitle?: string;
  confidence?: number;
}

export function saveExternalRef(ref: ExternalRefInput): string {
  const db = getDb();
  const id = uuidv4();
  db.prepare(`
    INSERT INTO song_external_refs (id, document_song_id, source, external_id, external_data, match_status, matched_title, confidence)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    ref.documentSongId,
    ref.source,
    ref.externalId || null,
    JSON.stringify(ref.externalData),
    ref.matchStatus,
    ref.matchedTitle || null,
    ref.confidence ?? 0,
  );
  return id;
}

export function saveExternalRefs(refs: ExternalRefInput[]): string[] {
  const db = getDb();
  const ids: string[] = [];
  const stmt = db.prepare(`
    INSERT INTO song_external_refs (id, document_song_id, source, external_id, external_data, match_status, matched_title, confidence)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    for (const ref of refs) {
      const id = uuidv4();
      ids.push(id);
      stmt.run(
        id,
        ref.documentSongId,
        ref.source,
        ref.externalId || null,
        JSON.stringify(ref.externalData),
        ref.matchStatus,
        ref.matchedTitle || null,
        ref.confidence ?? 0,
      );
    }
  });
  transaction();
  return ids;
}

export function getExternalRefs(documentSongId: string, source?: string) {
  const db = getDb();
  let sql = 'SELECT * FROM song_external_refs WHERE document_song_id = ?';
  const params: string[] = [documentSongId];
  if (source) {
    sql += ' AND source = ?';
    params.push(source);
  }
  sql += ' ORDER BY fetched_at DESC';
  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    source: r.source as string,
    external_id: r.external_id as string | null,
    external_data: JSON.parse(r.external_data as string) as Record<string, unknown>,
    match_status: r.match_status as string,
    matched_title: r.matched_title as string | null,
    confidence: r.confidence as number,
    fetched_at: r.fetched_at as string,
  }));
}

export function deleteDocument(id: string) {
  const db = getDb();
  const transaction = db.transaction(() => {
    const songIds = db.prepare('SELECT id FROM document_songs WHERE document_id = ?').all(id) as Array<{ id: string }>;
    for (const s of songIds) {
      db.prepare('DELETE FROM song_external_refs WHERE document_song_id = ?').run(s.id);
    }
    db.prepare('DELETE FROM document_songs WHERE document_id = ?').run(id);
    db.prepare('DELETE FROM documents WHERE id = ?').run(id);
  });
  transaction();
}

// === Stats (for dashboard) ===

export function getDashboardStats() {
  const db = getDb();
  const comparisons = (db.prepare('SELECT COUNT(*) as count FROM comparisons').get() as { count: number }).count;
  const exceptions = (db.prepare("SELECT COUNT(*) as count FROM exceptions WHERE resolution IS NULL").get() as { count: number }).count;
  const datasets = (db.prepare('SELECT COUNT(*) as count FROM datasets').get() as { count: number }).count;
  const connections = (db.prepare('SELECT COUNT(*) as count FROM connections').get() as { count: number }).count;
  const songs = (db.prepare('SELECT COUNT(*) as count FROM songs').get() as { count: number }).count;
  const documents = (db.prepare('SELECT COUNT(*) as count FROM documents').get() as { count: number }).count;
  return { comparisons, exceptions, datasets, connections, songs, documents };
}
