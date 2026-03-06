import ExcelJS from 'exceljs';

/**
 * Parse Excel file (.xlsx, .xls) into a structured dataset.
 * @param {Buffer} buffer - Raw file buffer
 * @param {object} options
 * @param {string|number} [options.sheet] - Sheet name or index (0-based). Defaults to first sheet.
 * @param {boolean} [options.header=true] - First row is header
 * @returns {Promise<{ columns: string[], rows: object[], rowCount: number, sheets: string[] }>}
 */
export async function parseExcel(buffer, options = {}) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheets = workbook.worksheets.map((ws) => ws.name);

  let worksheet;
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

  const rawRows = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = [];
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
    const row = { __rowIndex: idx };
    columns.forEach((col, i) => {
      row[col] = raw.values[i] ?? null;
    });
    return row;
  });

  return { columns, rows, rowCount: rows.length, sheets };
}

function extractCellValue(cell) {
  if (cell.value === null || cell.value === undefined) return null;
  if (typeof cell.value === 'object') {
    if (cell.value.result !== undefined) return cell.value.result;
    if (cell.value.text) return cell.value.text;
    if (cell.value instanceof Date) return cell.value.toISOString();
    return JSON.stringify(cell.value);
  }
  return cell.value;
}
