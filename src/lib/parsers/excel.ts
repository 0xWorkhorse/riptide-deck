import ExcelJS from 'exceljs';

export interface ExcelOptions {
  sheet?: string | number;
  header?: boolean;
}

export interface ExcelResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  sheets: string[];
}

export async function parseExcel(buffer: Buffer, options: ExcelOptions = {}): Promise<ExcelResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const sheets = workbook.worksheets.map((ws) => ws.name);

  let worksheet: ExcelJS.Worksheet | undefined;
  if (typeof options.sheet === 'number') {
    worksheet = workbook.worksheets[options.sheet];
  } else if (typeof options.sheet === 'string') {
    worksheet = workbook.getWorksheet(options.sheet);
  } else {
    worksheet = workbook.worksheets[0];
  }

  if (!worksheet) {
    throw new Error(`Sheet not found: ${options.sheet}`);
  }

  const rawRows: Array<{ rowNumber: number; values: unknown[] }> = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      values[colNumber - 1] = extractCellValue(cell);
    });
    rawRows.push({ rowNumber, values });
  });

  if (rawRows.length === 0) {
    return { columns: [], rows: [], rowCount: 0, sheets };
  }

  const hasHeader = options.header !== false;
  const columns = hasHeader
    ? rawRows[0].values.map((v, i) => (v != null ? String(v).trim() : `Column_${i + 1}`))
    : rawRows[0].values.map((_, i) => `Column_${i + 1}`);

  const dataRows = hasHeader ? rawRows.slice(1) : rawRows;
  const rows = dataRows.map((raw, idx) => {
    const row: Record<string, unknown> = { __rowIndex: idx };
    columns.forEach((col, i) => {
      row[col] = raw.values[i] ?? null;
    });
    return row;
  });

  return { columns, rows, rowCount: rows.length, sheets };
}

function extractCellValue(cell: ExcelJS.Cell): unknown {
  if (cell.value === null || cell.value === undefined) return null;
  if (typeof cell.value === 'object') {
    if ((cell.value as { result?: unknown }).result !== undefined) return (cell.value as { result: unknown }).result;
    if ((cell.value as { text?: string }).text) return (cell.value as { text: string }).text;
    if (cell.value instanceof Date) return cell.value.toISOString();
    return JSON.stringify(cell.value);
  }
  return cell.value;
}
