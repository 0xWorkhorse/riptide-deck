import { NextResponse } from 'next/server';
import { compareDatasets } from '@/lib/comparison/engine.js';
import {
  getDataset,
  saveComparison,
  saveExceptions,
  listComparisons,
  getComparison,
  deleteComparison,
} from '@/lib/db/store.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const { sourceAId, sourceBId, config, name } = body;

    if (!sourceAId || !sourceBId) {
      return NextResponse.json({ error: 'Both source datasets are required' }, { status: 400 });
    }

    if (!config?.keyColumns?.length) {
      return NextResponse.json({ error: 'At least one key column is required' }, { status: 400 });
    }

    const datasetA = getDataset(sourceAId);
    const datasetB = getDataset(sourceBId);

    if (!datasetA) return NextResponse.json({ error: 'Source A not found' }, { status: 404 });
    if (!datasetB) return NextResponse.json({ error: 'Source B not found' }, { status: 404 });

    const sourceA = {
      columns: datasetA.columns,
      rows: datasetA.data,
      sourceName: datasetA.name,
    };
    const sourceB = {
      columns: datasetB.columns,
      rows: datasetB.data,
      sourceName: datasetB.name,
    };

    const result = compareDatasets(sourceA, sourceB, config);

    // Save comparison and exceptions
    const comparisonId = saveComparison({
      id: result.id,
      name: name || `${datasetA.name} vs ${datasetB.name}`,
      sourceAId,
      sourceBId,
      config,
      summary: result.summary,
      status: 'completed',
    });

    saveExceptions(comparisonId, result.exceptions);

    return NextResponse.json({
      id: comparisonId,
      summary: result.summary,
      comparedColumns: result.comparedColumns,
      keyColumns: result.keyColumns,
      sourceAName: result.sourceAName,
      sourceBName: result.sourceBName,
      createdAt: result.createdAt,
    });
  } catch (err) {
    console.error('Comparison error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (id) {
    const comparison = getComparison(id);
    if (!comparison) {
      return NextResponse.json({ error: 'Comparison not found' }, { status: 404 });
    }
    return NextResponse.json(comparison);
  }

  const comparisons = listComparisons();
  return NextResponse.json({ comparisons });
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Comparison ID required' }, { status: 400 });
  }

  deleteComparison(id);
  return NextResponse.json({ success: true });
}
