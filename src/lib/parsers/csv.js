import Papa from 'papaparse';

/**
 * Parse CSV/TSV content into a structured dataset.
 * @param {Buffer|string} content - Raw file content
 * @param {object} options - Parser options
 * @param {string} [options.delimiter] - Auto-detected if not provided
 * @param {boolean} [options.header=true] - First row is header
 * @param {string} [options.encoding='utf-8'] - File encoding
 * @returns {{ columns: string[], rows: object[], rowCount: number, errors: object[] }}
 */
export function parseCSV(content, options = {}) {
  const text = typeof content === 'string' ? content : content.toString(options.encoding || 'utf-8');

  const result = Papa.parse(text, {
    header: options.header !== false,
    delimiter: options.delimiter || '',
    dynamicTyping: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });

  const columns = result.meta.fields || [];
  const rows = result.data.map((row, idx) => ({
    __rowIndex: idx,
    ...row,
  }));

  return {
    columns,
    rows,
    rowCount: rows.length,
    errors: result.errors.map((e) => ({
      row: e.row,
      type: e.type,
      code: e.code,
      message: e.message,
    })),
  };
}
