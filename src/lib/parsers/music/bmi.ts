import Papa from 'papaparse';
import type { DocumentSongInput } from '@/lib/db/store';

interface BmiRow {
  [key: string]: string | undefined;
}

/**
 * Parse a BMI catalog CSV export into structured song data.
 *
 * BMI CSV files typically contain columns like:
 * - Title, Work ID / BMI Work #, ISWC
 * - Writer/Composer names with IPI numbers
 * - Publisher names with IPI numbers
 * - Shares/percentages
 * - Role codes (C = Composer, A = Author/Lyricist, CA = Composer-Author, etc.)
 */
export async function parseBmiCsv(buffer: Buffer, _fileName: string): Promise<DocumentSongInput[]> {
  const csvText = buffer.toString('utf-8');

  const result = Papa.parse<BmiRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (h: string) => h.trim(),
  });

  if (!result.data || result.data.length === 0) {
    throw new Error('BMI CSV file contains no data rows');
  }

  const columns = result.meta.fields || [];
  const lowerColumns = columns.map((c) => c.toLowerCase());

  // Detect column mappings
  const findCol = (patterns: string[]): string | null => {
    for (const pattern of patterns) {
      const idx = lowerColumns.findIndex((c) => c.includes(pattern));
      if (idx >= 0) return columns[idx];
    }
    return null;
  };

  const titleCol = findCol(['title', 'work title', 'song title', 'song name']);
  const workIdCol = findCol(['work id', 'bmi work', 'bmi id', 'work #', 'work number']);
  const iswcCol = findCol(['iswc']);
  const writerCol = findCol(['writer', 'composer', 'author', 'creator']);
  const writerIpiCol = findCol(['writer ipi', 'composer ipi', 'author ipi', 'ipi #', 'ipi number', 'cae/ipi']);
  const writerRoleCol = findCol(['role', 'writer role', 'capacity']);
  const writerShareCol = findCol(['writer share', 'writer %', 'writer ownership', 'performance share']);
  const publisherCol = findCol(['publisher', 'pub name', 'publisher name']);
  const publisherIpiCol = findCol(['publisher ipi', 'pub ipi', 'publisher cae']);
  const publisherShareCol = findCol(['publisher share', 'pub share', 'pub %', 'publisher ownership']);

  if (!titleCol) {
    throw new Error('Could not find a title column in the BMI CSV. Expected columns like "Title" or "Work Title".');
  }

  // Group rows by song title + work ID (BMI files may have multiple rows per song for different writers)
  const songMap = new Map<string, { title: string; workId: string; iswc: string; rows: BmiRow[] }>();

  for (const row of result.data) {
    const title = (row[titleCol] || '').trim();
    if (!title) continue;

    const workId = workIdCol ? (row[workIdCol] || '').trim() : '';
    const iswc = iswcCol ? (row[iswcCol] || '').trim() : '';
    const key = workId || title.toLowerCase();

    if (!songMap.has(key)) {
      songMap.set(key, { title, workId, iswc, rows: [] });
    }
    songMap.get(key)!.rows.push(row);
  }

  const songs: DocumentSongInput[] = [];

  for (const [, songData] of songMap) {
    const contributors: DocumentSongInput['contributors'] = [];
    const publishers: DocumentSongInput['publishers'] = [];
    const seenWriters = new Set<string>();
    const seenPublishers = new Set<string>();

    for (const row of songData.rows) {
      // Extract writer
      if (writerCol) {
        const writerName = (row[writerCol] || '').trim();
        if (writerName && !seenWriters.has(writerName.toLowerCase())) {
          seenWriters.add(writerName.toLowerCase());
          const rawRole = writerRoleCol ? (row[writerRoleCol] || '').trim().toUpperCase() : '';
          let role = 'songwriter';
          if (rawRole === 'C' || rawRole === 'COMPOSER') role = 'composer';
          else if (rawRole === 'A' || rawRole === 'AUTHOR' || rawRole === 'LYRICIST') role = 'lyricist';
          else if (rawRole === 'CA' || rawRole === 'COMPOSER-AUTHOR') role = 'songwriter';
          else if (rawRole === 'AR' || rawRole === 'ARRANGER') role = 'arranger';

          contributors.push({
            name: writerName,
            role,
            ipi: writerIpiCol ? (row[writerIpiCol] || '').trim() || undefined : undefined,
            share: writerShareCol ? parseFloat(row[writerShareCol] || '0') || undefined : undefined,
          });
        }
      }

      // Extract publisher
      if (publisherCol) {
        const pubName = (row[publisherCol] || '').trim();
        if (pubName && !seenPublishers.has(pubName.toLowerCase())) {
          seenPublishers.add(pubName.toLowerCase());
          publishers.push({
            name: pubName,
            role: 'publisher',
            ipi: publisherIpiCol ? (row[publisherIpiCol] || '').trim() || undefined : undefined,
            share: publisherShareCol ? parseFloat(row[publisherShareCol] || '0') || undefined : undefined,
          });
        }
      }
    }

    // If no explicit writer column, try to extract from other columns
    if (contributors.length === 0) {
      for (const col of columns) {
        const lower = col.toLowerCase();
        if (lower.includes('writer') || lower.includes('composer') || lower.includes('author')) {
          for (const row of songData.rows) {
            const name = (row[col] || '').trim();
            if (name && !seenWriters.has(name.toLowerCase())) {
              seenWriters.add(name.toLowerCase());
              contributors.push({ name, role: 'songwriter' });
            }
          }
        }
      }
    }

    songs.push({
      title: songData.title,
      iswc: songData.iswc || undefined,
      bmiId: songData.workId || undefined,
      contributors,
      publishers,
      rawData: { source: 'bmi_csv', rowCount: songData.rows.length, firstRow: songData.rows[0] },
    });
  }

  return songs;
}
