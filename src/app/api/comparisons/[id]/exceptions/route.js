import { NextResponse } from 'next/server';
import {
  getExceptions,
  getExceptionCounts,
  updateException,
  bulkUpdateExceptions,
} from '@/lib/db/store.js';

export async function GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);

  const filters = {
    status: searchParams.get('status') || undefined,
    search: searchParams.get('search') || undefined,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
    offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined,
  };

  const exceptions = getExceptions(id, filters);
  const counts = getExceptionCounts(id);

  return NextResponse.json({ exceptions, counts, total: counts.total });
}

export async function PATCH(request, { params }) {
  const { id: comparisonId } = await params;
  const body = await request.json();

  if (body.bulk && Array.isArray(body.ids)) {
    bulkUpdateExceptions(body.ids, body.updates);
    return NextResponse.json({ success: true, updated: body.ids.length });
  }

  if (body.exceptionId) {
    updateException(body.exceptionId, body.updates);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}
