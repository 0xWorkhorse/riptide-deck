import { NextResponse } from 'next/server';
import { getComparison, getExceptions, getDataset } from '@/lib/db/store.js';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';

export async function POST(request) {
  try {
    const body = await request.json();
    const { comparisonId, format = 'csv', includeStatuses, enriched = true } = body;

    if (!comparisonId) {
      return NextResponse.json({ error: 'Comparison ID required' }, { status: 400 });
    }

    const comparison = getComparison(comparisonId);
    if (!comparison) {
      return NextResponse.json({ error: 'Comparison not found' }, { status: 404 });
    }

    // Get exceptions with optional status filter
    const filters = {};
    if (includeStatuses && includeStatuses.length > 0) {
      // Fetch all, then filter client side since our filter only supports one status
    }
    const allExceptions = getExceptions(comparisonId);

    let exceptions = allExceptions;
    if (includeStatuses && includeStatuses.length > 0) {
      exceptions = allExceptions.filter((e) => includeStatuses.includes(e.status));
    }

    // Build export rows
    const datasetA = getDataset(comparison.source_a_id);
    const columns = datasetA ? datasetA.columns : [];
    const exportColumns = [
      '__status',
      '__resolution',
      ...columns,
      ...(enriched ? ['__enriched_values'] : []),
      '__differences',
    ];

    const exportRows = exceptions.map((ex) => {
      const baseData = ex.sourceA || ex.sourceB || {};
      const enrichedVals = enriched ? ex.enrichedValues || {} : {};

      // Merge: base data + enriched overrides
      const merged = { ...baseData };
      for (const [key, val] of Object.entries(enrichedVals)) {
        if (val !== null && val !== undefined && val !== '') {
          merged[key] = val;
        }
      }

      const row = {
        __status: ex.status,
        __resolution: ex.resolution || '',
      };

      for (const col of columns) {
        row[col] = merged[col] ?? '';
      }

      if (enriched) {
        row.__enriched_values = Object.keys(enrichedVals).length > 0
          ? JSON.stringify(enrichedVals)
          : '';
      }

      row.__differences = ex.differences.length > 0
        ? ex.differences.map((d) => `${d.column}: ${d.valueA} → ${d.valueB}`).join('; ')
        : '';

      return row;
    });

    if (format === 'json') {
      return NextResponse.json({
        data: exportRows,
        metadata: {
          comparisonId,
          exportedAt: new Date().toISOString(),
          totalRows: exportRows.length,
          summary: comparison.summary,
        },
      });
    }

    if (format === 'csv') {
      const csv = Papa.unparse(exportRows, { columns: exportColumns });
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="comparison-${comparisonId}.csv"`,
        },
      });
    }

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Exceptions');

      worksheet.columns = exportColumns.map((col) => ({
        header: col,
        key: col,
        width: Math.max(col.length + 2, 15),
      }));

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' },
      };
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

      for (const row of exportRows) {
        const addedRow = worksheet.addRow(row);

        // Color code by status
        const statusColors = {
          matched: 'FF10B981',
          modified: 'FFF59E0B',
          added: 'FF3B82F6',
          removed: 'FFEF4444',
        };
        const color = statusColors[row.__status];
        if (color) {
          addedRow.getCell('__status').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: color },
          };
        }
      }

      const buffer = await workbook.xlsx.writeBuffer();
      return new Response(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="comparison-${comparisonId}.xlsx"`,
        },
      });
    }

    return NextResponse.json({ error: `Unsupported format: ${format}` }, { status: 400 });
  } catch (err) {
    console.error('Export error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
