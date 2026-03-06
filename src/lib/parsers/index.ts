import { parseCSV } from './csv';
import { parseExcel } from './excel';
import { parseJSON } from './json';

interface ParserEntry {
  parse: (buf: Buffer, opts?: Record<string, unknown>) => unknown;
  async: boolean;
}

const PARSERS: Record<string, ParserEntry> = {
  '.csv': { parse: (buf, opts) => parseCSV(buf, opts), async: false },
  '.tsv': { parse: (buf, opts) => parseCSV(buf, { ...opts, delimiter: '\t' }), async: false },
  '.txt': { parse: (buf, opts) => parseCSV(buf, opts), async: false },
  '.json': { parse: (buf, opts) => parseJSON(buf, opts), async: false },
  '.xlsx': { parse: (buf, opts) => parseExcel(buf, opts), async: true },
  '.xls': { parse: (buf, opts) => parseExcel(buf, opts), async: true },
};

export const SUPPORTED_EXTENSIONS = Object.keys(PARSERS);

export const SUPPORTED_MIME_TYPES = [
  'text/csv',
  'text/tab-separated-values',
  'text/plain',
  'application/json',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

export interface ParseResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  sourceType: string;
  sourceName: string;
  parsedAt: string;
  errors?: Array<{ row?: number; type: string; code: string; message: string }>;
  sheets?: string[];
}

export async function parseFile(buffer: Buffer, filename: string, options: Record<string, unknown> = {}): Promise<ParseResult> {
  const ext = getExtension(filename);
  const parser = PARSERS[ext];

  if (!parser) {
    throw new Error(
      `Unsupported file type: ${ext}. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`
    );
  }

  const result = parser.async ? await parser.parse(buffer, options) : parser.parse(buffer, options);

  return {
    ...(result as Record<string, unknown>),
    sourceType: 'file',
    sourceName: filename,
    parsedAt: new Date().toISOString(),
  } as ParseResult;
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot === -1) return '';
  return filename.slice(dot).toLowerCase();
}
