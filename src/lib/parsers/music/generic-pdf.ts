import type { DocumentSongInput } from '@/lib/db/store';

/**
 * Parse a generic PDF document (converted from Word, split sheet, etc.)
 * into structured song data.
 *
 * This parser handles unstructured documents by extracting text and using
 * heuristic pattern matching to identify:
 * - Song titles
 * - People names (writers, publishers)
 * - Percentages/splits
 * - Industry identifiers (ISWC, IPI, etc.)
 *
 * Since we cannot use a PDF library without adding dependencies,
 * we extract what we can from the raw buffer by reading embedded text strings.
 */
export async function parseGenericPdf(buffer: Buffer, _fileName: string): Promise<DocumentSongInput[]> {
  // Extract readable text from PDF buffer
  const text = extractTextFromPdf(buffer);

  if (!text || text.trim().length < 10) {
    throw new Error('Could not extract readable text from this PDF. The file may be image-based or encrypted.');
  }

  return parseTextToSongs(text);
}

/**
 * Extract text content from a PDF buffer by scanning for text stream content.
 * This is a lightweight extraction that works for text-based PDFs without
 * requiring a full PDF parsing library.
 */
function extractTextFromPdf(buffer: Buffer): string {
  const content = buffer.toString('latin1');
  const textParts: string[] = [];

  // Method 1: Extract text between BT (begin text) and ET (end text) operators
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(content)) !== null) {
    const block = match[1];
    // Extract text from Tj, TJ, and ' operators
    const tjMatches = block.match(/\(([^)]*)\)\s*Tj/g) || [];
    for (const tj of tjMatches) {
      const textMatch = tj.match(/\(([^)]*)\)/);
      if (textMatch) textParts.push(decodeText(textMatch[1]));
    }

    // TJ array operator
    const tjArrayMatches = block.match(/\[([^\]]*)\]\s*TJ/g) || [];
    for (const tja of tjArrayMatches) {
      const innerTexts = tja.match(/\(([^)]*)\)/g) || [];
      const combined = innerTexts.map((t) => {
        const m = t.match(/\(([^)]*)\)/);
        return m ? decodeText(m[1]) : '';
      }).join('');
      if (combined) textParts.push(combined);
    }
  }

  // Method 2: Try to find text in stream content (for simpler PDFs)
  if (textParts.length === 0) {
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    while ((match = streamRegex.exec(content)) !== null) {
      const streamContent = match[1];
      // Look for readable ASCII sequences
      const readableMatches = streamContent.match(/[A-Za-z][A-Za-z0-9\s,.'-]{4,}/g) || [];
      textParts.push(...readableMatches);
    }
  }

  // Method 3: Fall back to extracting any readable text sequences from the buffer
  if (textParts.length === 0) {
    const fullText = buffer.toString('utf-8');
    const readableLines = fullText.match(/[A-Za-z][A-Za-z0-9\s,.'-]{8,}/g) || [];
    textParts.push(...readableLines);
  }

  return textParts.join('\n');
}

function decodeText(encoded: string): string {
  // Handle common PDF text escape sequences
  return encoded
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}

/**
 * Parse extracted text content into song structures.
 */
function parseTextToSongs(text: string): DocumentSongInput[] {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const songs: DocumentSongInput[] = [];

  // Try to detect structure
  // Pattern 1: Look for song titles followed by contributor lists
  // Pattern 2: Look for tabular data with names and percentages

  // Detect if this looks like a split sheet (names + percentages)
  const percentageLines = lines.filter((l) => /%/.test(l) || /\b\d{1,3}\.\d+\b/.test(l));
  const hasPercentages = percentageLines.length > 0;

  // Detect proper names (two+ capitalized words)
  const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
  const allNames: string[] = [];
  for (const line of lines) {
    const matches = line.match(namePattern) || [];
    allNames.push(...matches);
  }

  // Unique names
  const uniqueNames = [...new Set(allNames)];

  // Try to identify song titles - usually the most prominent text
  // or lines that don't look like names or percentages
  const potentialTitles: string[] = [];
  const nonNameNonPercentLines = lines.filter((line) => {
    const isName = uniqueNames.some((n) => line.includes(n) && line.length < n.length + 20);
    const isPercentage = /^\s*\d{1,3}(\.\d+)?%?\s*$/.test(line.trim());
    const isIdentifier = /^[A-Z]-\d+$/.test(line.trim()) || /^T-\d+$/.test(line.trim());
    return !isName && !isPercentage && !isIdentifier && line.length > 2 && line.length < 100;
  });

  // Heuristic: if we have clear title candidates, use them
  for (const line of potentialTitles.length > 0 ? potentialTitles : nonNameNonPercentLines) {
    const clean = line.trim();
    // Skip lines that look like headers
    if (/^(song|title|name|writer|publisher|split|share|percentage|role)/i.test(clean)) continue;
    if (clean.length > 3 && clean.length < 100) {
      potentialTitles.push(clean);
    }
  }

  // If we found structured data (names + percentages), group by sections
  if (hasPercentages && uniqueNames.length > 0) {
    // Try section-based parsing
    const sectionSongs = parseSectioned(lines, uniqueNames);
    if (sectionSongs.length > 0) return sectionSongs;
  }

  // Fall back: treat each title candidate as a song with all detected names as contributors
  if (potentialTitles.length > 0) {
    for (const title of potentialTitles.slice(0, 50)) { // Cap at 50 songs
      const contributors = uniqueNames.map((name) => ({
        name,
        role: 'songwriter' as const,
      }));

      songs.push({
        title,
        contributors,
        publishers: [],
        rawData: { source: 'generic_pdf', extractedText: text.substring(0, 2000) },
      });
    }
  } else if (uniqueNames.length > 0) {
    // No clear titles found, create a single entry with all names
    songs.push({
      title: 'Untitled (from PDF)',
      contributors: uniqueNames.map((name) => ({ name, role: 'songwriter' })),
      publishers: [],
      rawData: { source: 'generic_pdf', extractedText: text.substring(0, 2000) },
    });
  }

  // Extract any ISWC, IPI, or other identifiers
  const iswcMatch = text.match(/T-\d{10,}/);
  const ipiMatches = text.match(/I-\d{9,}/g) || [];

  if (songs.length > 0 && iswcMatch) {
    songs[0].iswc = iswcMatch[0];
  }

  // Assign IPIs to contributors where possible
  if (ipiMatches.length > 0 && songs.length > 0) {
    for (let i = 0; i < Math.min(ipiMatches.length, songs[0].contributors.length); i++) {
      songs[0].contributors[i].ipi = ipiMatches[i];
    }
  }

  return songs;
}

/**
 * Parse text that appears to be divided into sections (one per song).
 */
function parseSectioned(lines: string[], allNames: string[]): DocumentSongInput[] {
  const songs: DocumentSongInput[] = [];

  // Look for section breaks - blank lines, horizontal rules, or numbered items
  let currentTitle = '';
  let currentContributors: DocumentSongInput['contributors'] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Check if this line is a title (not a name, not a percentage)
    const isName = allNames.some((n) => trimmed === n || trimmed.startsWith(n));
    const hasPercent = /\d+(\.\d+)?%/.test(trimmed);

    if (!isName && !hasPercent && trimmed.length > 2 && trimmed.length < 80) {
      // Looks like a new title
      if (currentTitle && currentContributors.length > 0) {
        songs.push({
          title: currentTitle,
          contributors: currentContributors,
          publishers: [],
          rawData: { source: 'generic_pdf' },
        });
      }
      currentTitle = trimmed;
      currentContributors = [];
    } else if (isName) {
      // This is a contributor name
      const name = allNames.find((n) => trimmed.includes(n)) || trimmed;
      const percentMatch = trimmed.match(/(\d+(\.\d+)?)%/);
      currentContributors.push({
        name,
        role: 'songwriter',
        share: percentMatch ? parseFloat(percentMatch[1]) : undefined,
      });
    }
  }

  // Don't forget the last section
  if (currentTitle && currentContributors.length > 0) {
    songs.push({
      title: currentTitle,
      contributors: currentContributors,
      publishers: [],
      rawData: { source: 'generic_pdf' },
    });
  }

  return songs;
}
