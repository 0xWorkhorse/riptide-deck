import { NextRequest, NextResponse } from 'next/server';
import {
  saveSong,
  getSong,
  listSongs,
  updateSong,
  updateSongContributors,
  deleteSong,
} from '@/lib/db/store';
import type { ContributorInput } from '@/lib/db/store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const song = getSong(id);
      if (!song) {
        return NextResponse.json({ error: 'Song not found' }, { status: 404 });
      }
      return NextResponse.json(song);
    }

    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const songs = listSongs({ search, status });
    return NextResponse.json({ songs });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { song, contributors } = body;

    if (!song?.title) {
      return NextResponse.json({ error: 'Song title is required' }, { status: 400 });
    }

    const id = saveSong(song, contributors || []);
    const saved = getSong(id);
    return NextResponse.json(saved, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Song ID required' }, { status: 400 });
    }

    const body = await request.json();
    const { song, contributors } = body;

    if (song) {
      updateSong(id, song);
    }
    if (contributors) {
      updateSongContributors(id, contributors as ContributorInput[]);
    }

    const updated = getSong(id);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Song ID required' }, { status: 400 });
    }

    deleteSong(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
