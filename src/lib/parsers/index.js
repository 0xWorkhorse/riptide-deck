import { parseCSV } from './csv.js';
import { parseExcel } from './excel.js';
import { parseJSON } from './json.js';

const PARSERS = {
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

/**
 * Parse a file buffer based on its extension.
 * @param {Buffer} buffer - File content
 * @param {string} filename - Original filename (used for extension detection)
 * @param {object} [options] - Parser-specific options
 * @returns {Promise<{ columns: string[], rows: object[], rowCount: number }>}
 */
export async function parseFile(buffer, filename, options = {}) {
  const ext = getExtension(filename);
  const parser = PARSERS[ext];

  if (!parser) {
    throw new Error(
      `Unsupported file type: ${ext}. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`
    );
  }

  const result = parser.async ? await parser.parse(buffer, options) : parser.parse(buffer, options);

  return {
    ...result,
    sourceType: 'file',
    sourceName: filename,
    parsedAt: new Date().toISOString(),
  };
}

function getExtension(filename) {
  const dot = filename.lastIndexOf('.');
  if (dot === -1) return '';
  return filename.slice(dot).toLowerCase();
}
