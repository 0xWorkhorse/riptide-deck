import { v4 as uuidv4 } from 'uuid';

/**
 * @typedef {'matched' | 'modified' | 'added' | 'removed'} ExceptionStatus
 *
 * @typedef {object} ComparisonConfig
 * @property {string[]} keyColumns - Columns used to match rows between datasets
 * @property {string[]} compareColumns - Columns to compare for differences (empty = all shared columns)
 * @property {Object<string, string>} columnMapping - Map source B columns to source A columns
 * @property {boolean} [caseSensitive=false] - Case-sensitive comparison
 * @property {number} [numericTolerance=0] - Tolerance for numeric comparisons
 * @property {boolean} [trimWhitespace=true] - Trim whitespace before comparing
 */

/**
 * @typedef {object} ComparisonResult
 * @property {string} id - Comparison ID
 * @property {object} summary - { matched, modified, added, removed, total }
 * @property {object[]} exceptions - Array of exception records
 * @property {string[]} comparedColumns - Columns that were compared
 * @property {string} createdAt
 */

/**
 * Compare two datasets and produce exceptions.
 *
 * @param {object} sourceA - "Reference" dataset { columns, rows }
 * @param {object} sourceB - "Incoming" dataset { columns, rows }
 * @param {ComparisonConfig} config
 * @returns {ComparisonResult}
 */
export function compareDatasets(sourceA, sourceB, config) {
  const { keyColumns, columnMapping = {}, caseSensitive = false, numericTolerance = 0, trimWhitespace = true } = config;

  if (!keyColumns || keyColumns.length === 0) {
    throw new Error('At least one key column is required for comparison');
  }

  // Resolve column mapping (B col name -> A col name)
  const resolveColB = (colB) => columnMapping[colB] || colB;

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

  const exceptions = [];
  const matchedKeys = new Set();

  // Compare: iterate source A, find matches in B
  for (const [key, rowA] of indexA.entries()) {
    if (indexB.has(key)) {
      matchedKeys.add(key);
      const rowB = indexB.get(key);
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

function buildIndex(rows, keyColumns, opts) {
  const index = new Map();
  for (const row of rows) {
    const key = keyColumns
      .map((col) => normalizeValue(row[col], opts))
      .join('||');
    index.set(key, row);
  }
  return index;
}

function normalizeValue(val, opts) {
  if (val === null || val === undefined) return '';
  let s = String(val);
  if (opts.trimWhitespace) s = s.trim();
  if (!opts.caseSensitive) s = s.toLowerCase();
  return s;
}

function compareRows(rowA, rowB, columns, resolveColB, opts) {
  const diffs = [];
  for (const colA of columns) {
    const colB = Object.entries({}).length === 0 ? colA : colA; // resolveColB is for B->A, we need A->B
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

function valuesEqual(a, b, opts) {
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

function extractKeyValues(row, keyColumns) {
  const values = {};
  for (const col of keyColumns) {
    values[col] = row[col];
  }
  return values;
}

function remapRow(row, columnMapping) {
  if (!columnMapping || Object.keys(columnMapping).length === 0) return row;
  const remapped = { __rowIndex: row.__rowIndex };
  for (const [key, value] of Object.entries(row)) {
    if (key === '__rowIndex') continue;
    const mappedKey = columnMapping[key] || key;
    remapped[mappedKey] = value;
  }
  return remapped;
}
