import Papa from 'papaparse';

export interface CSVOptions {
  delimiter?: string;
  header?: boolean;
  encoding?: BufferEncoding;
}

export interface CSVResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  errors: Array<{ row?: number; type: string; code: string; message: string }>;
}

export function parseCSV(content: Buffer | string, options: CSVOptions = {}): CSVResult {
  const text = typeof content === 'string' ? content : content.toString(options.encoding || 'utf-8');

  const result = Papa.parse(text, {
    header: options.header !== false,
    delimiter: options.delimiter || '',
    dynamicTyping: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h: string) => h.trim(),
  });

  const columns = result.meta.fields || [];
  const rows = (result.data as Record<string, unknown>[]).map((row, idx) => ({
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
