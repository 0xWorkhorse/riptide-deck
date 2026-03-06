import ExcelJS from 'exceljs';
import type { DocumentSongInput } from '@/lib/db/store';

/**
 * Parse a Curve catalog Excel export into structured song data.
 *
 * Curve files are multi-sheet Excel workbooks with complex relationships:
 * - Works sheet: song titles, ISWCs, work IDs
 * - Writers sheet: songwriter names, IPIs, shares
 * - Publishers sheet: publisher names, IPIs, shares
 * - Recordings sheet: ISRC codes, artist names
 *
 * The sheets are linked by work IDs or internal reference numbers.
 */
export async function parseCurveExcel(buffer: Buffer, _fileName: string): Promise<DocumentSongInput[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const sheetNames = workbook.worksheets.map((ws) => ws.name.toLowerCase());

  // Find relevant sheets
  const findSheet = (patterns: string[]) => {
    for (const pattern of patterns) {
      const idx = sheetNames.findIndex((n) => n.includes(pattern));
      if (idx >= 0) return workbook.worksheets[idx];
    }
    return null;
  };

  const worksSheet = findSheet(['work', 'song', 'title', 'catalog', 'composition']);
  const writersSheet = findSheet(['writer', 'composer', 'creator', 'author']);
  const publishersSheet = findSheet(['publisher', 'pub']);
  const recordingsSheet = findSheet(['recording', 'track', 'isrc']);

  // If only one sheet exists, parse it as a flat file
  if (workbook.worksheets.length === 1 || !worksSheet) {
    return parseFlatExcel(workbook.worksheets[0]);
  }

  // Parse the works sheet to get base song data
  const worksHeaders = getHeaders(worksSheet);
  const worksRows = getDataRows(worksSheet, worksHeaders);

  // Parse writers if available
  const writersByWorkId = new Map<string, Array<{ name: string; role: string; ipi?: string; share?: number }>>();
  if (writersSheet) {
    const wHeaders = getHeaders(writersSheet);
    const wRows = getDataRows(writersSheet, wHeaders);
    for (const row of wRows) {
      const workId = findValue(row, ['work id', 'work_id', 'work ref', 'reference', 'work number', 'work #']);
      const name = findValue(row, ['name', 'writer', 'writer name', 'composer', 'full name']);
      if (!workId || !name) continue;

      if (!writersByWorkId.has(workId)) writersByWorkId.set(workId, []);
      const rawRole = findValue(row, ['role', 'capacity', 'type']) || '';
      let role = 'songwriter';
      if (rawRole.toLowerCase().includes('compos')) role = 'composer';
      else if (rawRole.toLowerCase().includes('lyric') || rawRole.toLowerCase().includes('author')) role = 'lyricist';
      else if (rawRole.toLowerCase().includes('arrang')) role = 'arranger';

      writersByWorkId.get(workId)!.push({
        name,
        role,
        ipi: findValue(row, ['ipi', 'ipi #', 'cae', 'cae/ipi']) || undefined,
        share: parseFloat(findValue(row, ['share', 'ownership', '%', 'writer share']) || '0') || undefined,
      });
    }
  }

  // Parse publishers if available
  const publishersByWorkId = new Map<string, Array<{ name: string; role: string; ipi?: string; share?: number }>>();
  if (publishersSheet) {
    const pHeaders = getHeaders(publishersSheet);
    const pRows = getDataRows(publishersSheet, pHeaders);
    for (const row of pRows) {
      const workId = findValue(row, ['work id', 'work_id', 'work ref', 'reference', 'work number', 'work #']);
      const name = findValue(row, ['name', 'publisher', 'publisher name', 'pub name']);
      if (!workId || !name) continue;

      if (!publishersByWorkId.has(workId)) publishersByWorkId.set(workId, []);
      const rawRole = findValue(row, ['role', 'type', 'capacity']) || 'publisher';
      let role = 'publisher';
      if (rawRole.toLowerCase().includes('admin')) role = 'administrator';
      else if (rawRole.toLowerCase().includes('sub')) role = 'sub_publisher';
      else if (rawRole.toLowerCase().includes('original')) role = 'original_publisher';

      publishersByWorkId.get(workId)!.push({
        name,
        role,
        ipi: findValue(row, ['ipi', 'ipi #', 'cae', 'cae/ipi']) || undefined,
        share: parseFloat(findValue(row, ['share', 'ownership', '%', 'publisher share']) || '0') || undefined,
      });
    }
  }

  // Parse recordings if available
  const artistByWorkId = new Map<string, string>();
  if (recordingsSheet) {
    const rHeaders = getHeaders(recordingsSheet);
    const rRows = getDataRows(recordingsSheet, rHeaders);
    for (const row of rRows) {
      const workId = findValue(row, ['work id', 'work_id', 'work ref', 'reference', 'work number']);
      const artist = findValue(row, ['artist', 'performer', 'recording artist', 'artist name']);
      if (workId && artist) artistByWorkId.set(workId, artist);
    }
  }

  // Build songs
  const songs: DocumentSongInput[] = [];

  for (const row of worksRows) {
    const title = findValue(row, ['title', 'work title', 'song title', 'song name', 'composition title']);
    if (!title) continue;

    const workId = findValue(row, ['work id', 'work_id', 'reference', 'work ref', 'id', 'work number', 'work #']);
    const iswc = findValue(row, ['iswc', 'iswc code']);
    const bmiId = findValue(row, ['bmi id', 'bmi work id', 'bmi #', 'bmi work']);
    const ascapId = findValue(row, ['ascap id', 'ascap work id', 'ascap #']);
    const mlcId = findValue(row, ['mlc id', 'mlc work id']);

    const contributors = workId ? (writersByWorkId.get(workId) || []) : [];
    const publishers = workId ? (publishersByWorkId.get(workId) || []) : [];
    const artist = workId ? artistByWorkId.get(workId) : undefined;

    // If no linked writers found, try inline columns
    if (contributors.length === 0) {
      const inlineWriter = findValue(row, ['writer', 'composer', 'writer 1', 'composer 1']);
      if (inlineWriter) contributors.push({ name: inlineWriter, role: 'songwriter' });
      const inlineWriter2 = findValue(row, ['writer 2', 'composer 2']);
      if (inlineWriter2) contributors.push({ name: inlineWriter2, role: 'songwriter' });
    }

    songs.push({
      title,
      artist: artist || findValue(row, ['artist', 'performer']) || undefined,
      iswc: iswc || undefined,
      bmiId: bmiId || undefined,
      ascapId: ascapId || undefined,
      mlcId: mlcId || undefined,
      contributors,
      publishers,
      rawData: { source: 'curve_excel', workId, row },
    });
  }

  return songs;
}

function parseFlatExcel(sheet: ExcelJS.Worksheet): DocumentSongInput[] {
  const headers = getHeaders(sheet);
  const rows = getDataRows(sheet, headers);
  const songs: DocumentSongInput[] = [];

  for (const row of rows) {
    const title = findValue(row, ['title', 'work title', 'song title', 'song', 'name', 'track']);
    if (!title) continue;

    const contributors: DocumentSongInput['contributors'] = [];
    const writerName = findValue(row, ['writer', 'composer', 'songwriter', 'writer 1']);
    if (writerName) contributors.push({ name: writerName, role: 'songwriter' });
    const writer2 = findValue(row, ['writer 2', 'composer 2', 'co-writer']);
    if (writer2) contributors.push({ name: writer2, role: 'songwriter' });

    const publishers: DocumentSongInput['publishers'] = [];
    const pubName = findValue(row, ['publisher', 'publisher name', 'pub']);
    if (pubName) publishers.push({ name: pubName, role: 'publisher' });

    songs.push({
      title,
      artist: findValue(row, ['artist', 'performer', 'recording artist']) || undefined,
      iswc: findValue(row, ['iswc']) || undefined,
      bmiId: findValue(row, ['bmi id', 'bmi work id']) || undefined,
      ascapId: findValue(row, ['ascap id', 'ascap work id']) || undefined,
      mlcId: findValue(row, ['mlc id', 'mlc work id']) || undefined,
      contributors,
      publishers,
      rawData: { source: 'curve_excel', row },
    });
  }

  return songs;
}

function getHeaders(sheet: ExcelJS.Worksheet): string[] {
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const val = getCellValue(cell);
    headers[colNumber - 1] = val;
  });
  return headers;
}

function getDataRows(sheet: ExcelJS.Worksheet, headers: string[]): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header
    const record: Record<string, string> = {};
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (header) {
        record[header] = getCellValue(cell);
      }
    });
    if (Object.keys(record).length > 0) rows.push(record);
  });
  return rows;
}

function getCellValue(cell: ExcelJS.Cell): string {
  const val = cell.value;
  if (val === null || val === undefined) return '';
  if (typeof val === 'object' && 'result' in val) return String((val as ExcelJS.CellFormulaValue).result ?? '');
  if (typeof val === 'object' && 'text' in val) return (val as unknown as { text: string }).text || '';
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function findValue(row: Record<string, string>, patterns: string[]): string | null {
  const keys = Object.keys(row);
  const lowerKeys = keys.map((k) => k.toLowerCase());
  for (const pattern of patterns) {
    const idx = lowerKeys.findIndex((k) => k === pattern || k.includes(pattern));
    if (idx >= 0) {
      const val = row[keys[idx]]?.trim();
      if (val) return val;
    }
  }
  return null;
}
