import { NextRequest, NextResponse } from 'next/server';
import { getDocumentSong, saveExternalRefs } from '@/lib/db/store';
import type { ExternalRefInput } from '@/lib/db/store';

/**
 * Simulate cross-reference lookups against MLC and SongView databases.
 * In production, these would be real API calls or database lookups.
 */
function simulateMlcLookup(title: string, contributors: Array<{ name: string }>) {
  // Simulate MLC database lookup based on title and writer names
  const titleHash = title.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const mlcId = `A${String(titleHash * 7).padStart(9, '0')}`;

  const matchedPublishers: Array<{ name: string; role: string; ipi?: string }> = [];

  // Simulate finding additional publishers
  if (contributors.length > 0) {
    matchedPublishers.push({
      name: `${contributors[0].name} Publishing`,
      role: 'publisher',
      ipi: `I-${String(titleHash * 3).padStart(9, '0')}`,
    });
    if (contributors.length > 1) {
      matchedPublishers.push({
        name: `${contributors[1].name} Music Admin`,
        role: 'administrator',
        ipi: `I-${String(titleHash * 5).padStart(9, '0')}`,
      });
    }
  }

  return {
    mlcId,
    matchedTitle: title,
    publishers: matchedPublishers,
    confidence: 0.92,
  };
}

function simulateSongviewLookup(title: string, contributors: Array<{ name: string }>) {
  const titleHash = title.split('').reduce((a, c) => a + c.charCodeAt(0), 0);

  const ascapId = `${String(titleHash * 11).padStart(9, '0')}`;
  const bmiId = `${String(titleHash * 13).padStart(9, '0')}`;
  const iswc = `T-${String(titleHash * 17).padStart(10, '0')}`;

  const matchedPublishers: Array<{ name: string; role: string; ipi?: string; pro?: string }> = [];

  if (contributors.length > 0) {
    matchedPublishers.push({
      name: `${contributors[0].name} Songs`,
      role: 'publisher',
      ipi: `I-${String(titleHash * 19).padStart(9, '0')}`,
      pro: 'ASCAP',
    });
  }

  return {
    ascapId,
    bmiId,
    iswc,
    matchedTitle: title,
    publishers: matchedPublishers,
    confidence: 0.88,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; songId: string }> },
) {
  try {
    const { songId } = await params;
    const body = await request.json();
    const sources: string[] = body.sources || ['mlc', 'songview'];

    const song = getDocumentSong(songId);
    if (!song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 });
    }

    const refs: ExternalRefInput[] = [];
    const results: Record<string, unknown> = {};

    for (const source of sources) {
      if (source === 'mlc') {
        const mlcResult = simulateMlcLookup(song.title, song.contributors);
        const missingFields: string[] = [];
        const conflictFields: string[] = [];

        // Check what's missing vs conflicting
        if (!song.mlc_id && mlcResult.mlcId) missingFields.push('mlc_id');
        if (song.mlc_id && mlcResult.mlcId && song.mlc_id !== mlcResult.mlcId) conflictFields.push('mlc_id');

        // Check publisher differences
        const existingPubNames = new Set(song.publishers.map((p) => p.name.toLowerCase()));
        for (const pub of mlcResult.publishers) {
          if (!existingPubNames.has(pub.name.toLowerCase())) {
            missingFields.push(`publisher:${pub.name}`);
          }
        }

        const matchStatus = conflictFields.length > 0 ? 'conflict' : missingFields.length > 0 ? 'missing' : 'match';

        refs.push({
          documentSongId: songId,
          source: 'mlc',
          externalId: mlcResult.mlcId,
          externalData: {
            ...mlcResult,
            missingFields,
            conflictFields,
          },
          matchStatus,
          matchedTitle: mlcResult.matchedTitle,
          confidence: mlcResult.confidence,
        });

        results.mlc = { ...mlcResult, matchStatus, missingFields, conflictFields };
      }

      if (source === 'songview') {
        // Add slight delay to simulate network request
        await new Promise((resolve) => setTimeout(resolve, 500));

        const svResult = simulateSongviewLookup(song.title, song.contributors);
        const missingFields: string[] = [];
        const conflictFields: string[] = [];

        if (!song.ascap_id && svResult.ascapId) missingFields.push('ascap_id');
        if (song.ascap_id && svResult.ascapId && song.ascap_id !== svResult.ascapId) conflictFields.push('ascap_id');
        if (!song.bmi_id && svResult.bmiId) missingFields.push('bmi_id');
        if (song.bmi_id && svResult.bmiId && song.bmi_id !== svResult.bmiId) conflictFields.push('bmi_id');
        if (!song.iswc && svResult.iswc) missingFields.push('iswc');

        const existingPubNames = new Set(song.publishers.map((p) => p.name.toLowerCase()));
        for (const pub of svResult.publishers) {
          if (!existingPubNames.has(pub.name.toLowerCase())) {
            missingFields.push(`publisher:${pub.name}`);
          }
        }

        const matchStatus = conflictFields.length > 0 ? 'conflict' : missingFields.length > 0 ? 'missing' : 'match';

        refs.push({
          documentSongId: songId,
          source: 'songview',
          externalId: svResult.ascapId,
          externalData: {
            ...svResult,
            missingFields,
            conflictFields,
          },
          matchStatus,
          matchedTitle: svResult.matchedTitle,
          confidence: svResult.confidence,
        });

        results.songview = { ...svResult, matchStatus, missingFields, conflictFields };
      }
    }

    // Save external references
    if (refs.length > 0) {
      saveExternalRefs(refs);
    }

    return NextResponse.json({ results, song: getDocumentSong(songId) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
