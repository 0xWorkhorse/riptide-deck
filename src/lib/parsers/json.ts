export interface JSONParseOptions {
  dataPath?: string;
}

export interface JSONResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export function parseJSON(content: Buffer | string, options: JSONParseOptions = {}): JSONResult {
  const text = typeof content === 'string' ? content : content.toString('utf-8');
  const parsed = JSON.parse(text);

  let data: unknown[];
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
  } else {
    data = [];
  }

  if (!Array.isArray(data)) {
    throw new Error('Could not find an array of records in the JSON file');
  }

  // Flatten nested objects one level deep
  const flatData = data.map((item) => flattenObject(item as Record<string, unknown>));

  // Collect all unique columns
  const columnSet = new Set<string>();
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

function getNestedValue(obj: unknown, path: string): unknown[] {
  return path.split('.').reduce((current: unknown, key: string) => (current as Record<string, unknown>)?.[key], obj) as unknown[];
}

function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}
