import { NextResponse, NextRequest } from 'next/server';
import { listDatasets, getDataset, deleteDataset } from '@/lib/db/store';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (id) {
    const dataset = getDataset(id);
    if (!dataset) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });
    }
    return NextResponse.json(dataset);
  }

  const datasets = listDatasets();
  return NextResponse.json({ datasets });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Dataset ID required' }, { status: 400 });
  }

  deleteDataset(id);
  return NextResponse.json({ success: true });
}
