import { NextRequest, NextResponse } from 'next/server';
import { listDocuments, getDocument, deleteDocument } from '@/lib/db/store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const doc = getDocument(id);
      if (!doc) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      }
      return NextResponse.json(doc);
    }

    const documents = listDocuments();
    return NextResponse.json({ documents });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Document ID required' }, { status: 400 });
    }
    deleteDocument(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
