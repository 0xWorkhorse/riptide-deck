import { v4 as uuidv4 } from 'uuid';

export type ExceptionStatus = 'matched' | 'modified' | 'added' | 'removed';

export interface ComparisonConfig {
  keyColumns: string[];
  compareColumns?: string[];
  columnMapping?: Record<string, string>;
  caseSensitive?: boolean;
  numericTolerance?: number;
  trimWhitespace?: boolean;
}

export interface DatasetSource {
  columns: string[];
  rows: Record<string, unknown>[];
  sourceName?: string;
}

interface NormalizeOpts {
  caseSensitive: boolean;
  trimWhitespace: boolean;
}

interface CompareOpts extends NormalizeOpts {
  numericTolerance: number;
}

export interface ExceptionRecord {
  id: string;
  status: ExceptionStatus;
  key: string;
  keyValues: Record<string, unknown>;
  sourceA: Record<string, unknown> | null;
  sourceB: Record<string, unknown> | null;
  differences: Array<{ column: string; valueA: unknown; valueB: unknown }>;
  resolution: string | null;
  enrichedValues: Record<string, unknown>;
}

export interface ComparisonResult {
  id: string;
  summary: {
    matched: number;
    modified: number;
    added: number;
    removed: number;
    total: number;
  };
  exceptions: ExceptionRecord[];
  comparedColumns: string[];
  keyColumns: string[];
  sourceAName: string;
  sourceBName: string;
  createdAt: string;
}

export function compareDatasets(sourceA: DatasetSource, sourceB: DatasetSource, config: ComparisonConfig): ComparisonResult {
  const { keyColumns, columnMapping = {}, caseSensitive = false, numericTolerance = 0, trimWhitespace = true } = config;

  if (!keyColumns || keyColumns.length === 0) {
    throw new Error('At least one key column is required for comparison');
  }

  // Resolve column mapping (B col name -> A col name)
  const resolveColB = (colB: string): string => columnMapping[colB] || colB;

  // Determine which columns to compare
  const sharedColumns = sourceA.columns.filter((colA) => {
    return sourceB.columns.some((colB) => resolveColB(colB) === colA);
  });

  const compareColumns =
    config.compareColumns && config.compareColumns.length > 0
      ? config.compareColumns.filter((c) => sharedColumns.includes(c))
      : sharedColumns.filter((c) => !keyColumns.includes(c));

  // Build index of source A rows by composite key
  const indexA = buildIndex(sourceA.rows, keyColumns, { caseSensitive, trimWhitespace });

  // Build index of source B rows by composite key (using column mapping)
  const keyColumnsB = keyColumns.map((kA) => {
    const mappedB = Object.entries(columnMapping).find(([, vA]) => vA === kA);
    return mappedB ? mappedB[0] : kA;
  });
  const indexB = buildIndex(sourceB.rows, keyColumnsB, { caseSensitive, trimWhitespace });

  const exceptions: ExceptionRecord[] = [];
  const matchedKeys = new Set<string>();

  // Compare: iterate source A, find matches in B
  for (const [key, rowA] of indexA.entries()) {
    if (indexB.has(key)) {
      matchedKeys.add(key);
      const rowB = indexB.get(key)!;
      const diffs = compareRows(rowA, rowB, compareColumns, resolveColB, {
        caseSensitive,
        numericTolerance,
        trimWhitespace,
      });

      if (diffs.length > 0) {
        exceptions.push({
          id: uuidv4(),
          status: 'modified',
          key,
          keyValues: extractKeyValues(rowA, keyColumns),
          sourceA: rowA,
          sourceB: remapRow(rowB, columnMapping),
          differences: diffs,
          resolution: null,
          enrichedValues: {},
        });
      } else {
        exceptions.push({
          id: uuidv4(),
          status: 'matched',
          key,
          keyValues: extractKeyValues(rowA, keyColumns),
          sourceA: rowA,
          sourceB: remapRow(rowB, columnMapping),
          differences: [],
          resolution: null,
          enrichedValues: {},
        });
      }
    } else {
      // In A but not in B: "removed" from incoming
      exceptions.push({
        id: uuidv4(),
        status: 'removed',
        key,
        keyValues: extractKeyValues(rowA, keyColumns),
        sourceA: rowA,
        sourceB: null,
        differences: [],
        resolution: null,
        enrichedValues: {},
      });
    }
  }

  // Records in B but not in A: "added" in incoming
  for (const [key, rowB] of indexB.entries()) {
    if (!matchedKeys.has(key) && !indexA.has(key)) {
      exceptions.push({
        id: uuidv4(),
        status: 'added',
        key,
        keyValues: extractKeyValues(rowB, keyColumnsB),
        sourceA: null,
        sourceB: remapRow(rowB, columnMapping),
        differences: [],
        resolution: null,
        enrichedValues: {},
      });
    }
  }

  const summary = {
    matched: exceptions.filter((e) => e.status === 'matched').length,
    modified: exceptions.filter((e) => e.status === 'modified').length,
    added: exceptions.filter((e) => e.status === 'added').length,
    removed: exceptions.filter((e) => e.status === 'removed').length,
    total: exceptions.length,
  };

  return {
    id: uuidv4(),
    summary,
    exceptions,
    comparedColumns: compareColumns,
    keyColumns,
    sourceAName: sourceA.sourceName || 'Source A',
    sourceBName: sourceB.sourceName || 'Source B',
    createdAt: new Date().toISOString(),
  };
}

function buildIndex(rows: Record<string, unknown>[], keyColumns: string[], opts: NormalizeOpts): Map<string, Record<string, unknown>> {
  const index = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = keyColumns
      .map((col) => normalizeValue(row[col], opts))
      .join('||');
    index.set(key, row);
  }
  return index;
}

function normalizeValue(val: unknown, opts: NormalizeOpts): string {
  if (val === null || val === undefined) return '';
  let s = String(val);
  if (opts.trimWhitespace) s = s.trim();
  if (!opts.caseSensitive) s = s.toLowerCase();
  return s;
}

function compareRows(
  rowA: Record<string, unknown>,
  rowB: Record<string, unknown>,
  columns: string[],
  resolveColB: (col: string) => string,
  opts: CompareOpts
): Array<{ column: string; valueA: unknown; valueB: unknown }> {
  const diffs: Array<{ column: string; valueA: unknown; valueB: unknown }> = [];
  for (const colA of columns) {
    const valA = rowA[colA];
    // Find the B column that maps to this A column
    const valB = rowB[colA] !== undefined ? rowB[colA] : rowB[resolveColB(colA)];

    if (!valuesEqual(valA, valB, opts)) {
      diffs.push({
        column: colA,
        valueA: valA,
        valueB: valB ?? rowB[colA],
      });
    }
  }
  return diffs;
}

function valuesEqual(a: unknown, b: unknown, opts: CompareOpts): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;

  // Numeric comparison with tolerance
  const numA = Number(a);
  const numB = Number(b);
  if (!isNaN(numA) && !isNaN(numB)) {
    return Math.abs(numA - numB) <= (opts.numericTolerance || 0);
  }

  // String comparison
  let strA = String(a);
  let strB = String(b);
  if (opts.trimWhitespace) {
    strA = strA.trim();
    strB = strB.trim();
  }
  if (!opts.caseSensitive) {
    strA = strA.toLowerCase();
    strB = strB.toLowerCase();
  }
  return strA === strB;
}

function extractKeyValues(row: Record<string, unknown>, keyColumns: string[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const col of keyColumns) {
    values[col] = row[col];
  }
  return values;
}

function remapRow(row: Record<string, unknown>, columnMapping: Record<string, string>): Record<string, unknown> {
  if (!columnMapping || Object.keys(columnMapping).length === 0) return row;
  const remapped: Record<string, unknown> = { __rowIndex: row.__rowIndex };
  for (const [key, value] of Object.entries(row)) {
    if (key === '__rowIndex') continue;
    const mappedKey = columnMapping[key] || key;
    remapped[mappedKey] = value;
  }
  return remapped;
}
