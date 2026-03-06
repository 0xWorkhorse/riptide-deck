/**
 * Parse JSON content into a structured dataset.
 * Supports: array of objects, { data: [...] }, { rows: [...] }, { results: [...] }
 * @param {Buffer|string} content - Raw file content
 * @param {object} options
 * @param {string} [options.dataPath] - JSON path to the array (e.g., "data", "results.items")
 * @returns {{ columns: string[], rows: object[], rowCount: number }}
 */
export function parseJSON(content, options = {}) {
  const text = typeof content === 'string' ? content : content.toString('utf-8');
  const parsed = JSON.parse(text);

  let data;
  if (options.dataPath) {
    data = getNestedValue(parsed, options.dataPath);
  } else if (Array.isArray(parsed)) {
    data = parsed;
  } else if (typeof parsed === 'object') {
    const arrayKeys = ['data', 'rows', 'results', 'items', 'records'];
    const found = arrayKeys.find((k) => Array.isArray(parsed[k]));
    if (found) {
      data = parsed[found];
    } else {
      const firstArrayKey = Object.keys(parsed).find((k) => Array.isArray(parsed[k]));
      data = firstArrayKey ? parsed[firstArrayKey] : [parsed];
    }
  }

  if (!Array.isArray(data)) {
    throw new Error('Could not find an array of records in the JSON file');
  }

  // Flatten nested objects one level deep
  const flatData = data.map((item) => flattenObject(item));

  // Collect all unique columns
  const columnSet = new Set();
  flatData.forEach((row) => {
    Object.keys(row).forEach((k) => columnSet.add(k));
  });
  const columns = Array.from(columnSet);

  const rows = flatData.map((row, idx) => ({
    __rowIndex: idx,
    ...Object.fromEntries(columns.map((c) => [c, row[c] ?? null])),
  }));

  return { columns, rows, rowCount: rows.length };
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function flattenObject(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      Object.assign(result, flattenObject(value, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}
