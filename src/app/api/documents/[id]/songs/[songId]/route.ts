import { NextRequest, NextResponse } from 'next/server';
import { getDocumentSong, updateDocumentSong } from '@/lib/db/store';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; songId: string }> },
) {
  try {
    const { songId } = await params;
    const song = getDocumentSong(songId);
    if (!song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 });
    }
    return NextResponse.json(song);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; songId: string }> },
) {
  try {
    const { songId } = await params;
    const updates = await request.json();
    updateDocumentSong(songId, updates);
    const updated = getDocumentSong(songId);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
