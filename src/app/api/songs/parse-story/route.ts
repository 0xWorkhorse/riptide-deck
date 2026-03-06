import { NextRequest, NextResponse } from 'next/server';

interface ParsedContributor {
  name: string;
  role: string;
  splitType: string;
}

interface ParsedSongData {
  title: string | null;
  artist: string | null;
  album: string | null;
  recordLabel: string | null;
  contributors: ParsedContributor[];
  followUpQuestions: string[];
  confidence: number;
}

/**
 * Parse a narrative story about a song into structured registration data.
 * Uses rule-based NLP extraction. Can be enhanced with AI API integration later.
 */
function parseStoryToSongData(story: string, context?: Record<string, string>): ParsedSongData {
  const text = story.trim();

  // Extract song title - look for patterns like "called X", "titled X", "song X", quoted titles
  let title: string | null = null;
  const titlePatterns = [
    /(?:song\s+(?:is\s+)?(?:called|titled|named))\s+["']([^"']+)["']/i,
    /(?:called|titled|named)\s+["']([^"']+)["']/i,
    /["']([^"']+)["']\s+(?:was\s+)?(?:written|by|from|is\s+a)/i,
    /(?:song\s+(?:is\s+)?(?:called|titled|named))\s+([A-Z][A-Za-z\s]+?)(?:\s+(?:was|by|for|on|and|,|\.))/i,
    /(?:called|titled|named)\s+([A-Z][A-Za-z\s]+?)(?:\s+(?:was|by|for|on|and|with|,|\.))/i,
    // "X was written by" pattern (common narrative form)
    /^([A-Z][A-Za-z\s]+?)\s+was\s+(?:written|composed|created|made|recorded)/i,
    // "the song X" without "called/titled"
    /the\s+song\s+["']([^"']+)["']/i,
    /the\s+song\s+([A-Z][A-Za-z\s]+?)(?:\s+(?:was|by|for|on|,|\.))/i,
  ];
  for (const pattern of titlePatterns) {
    const match = text.match(pattern);
    if (match) {
      title = match[1].trim();
      break;
    }
  }

  // Extract artist/band - use tight patterns to avoid capturing extra text
  let artist: string | null = null;
  const artistPatterns = [
    /(?:the\s+)?artist\s+is\s+["']([^"']+)["']/i,
    /(?:the\s+)?artist\s+is\s+([A-Z][A-Za-z\s]+?)(?:\s*[.,]|\s+(?:and|who|which|on|for|from)\b)/i,
    /(?:the\s+)?artist\s+is\s+([A-Z][A-Za-z\s]+?)$/im,
    /by\s+(?:a\s+(?:band|artist|group|singer)\s+called\s+)["']?([^"'\n,.]+?)["']?(?:\s*[.,]|\s+(?:and|on|for|from)\b)/i,
    /by\s+(?:the\s+)?(?:band|artist|group)\s+["']?([^"'\n,.]+?)["']?(?:\s*[.,]|\s+(?:and|on|for|from)\b)/i,
    /(?:band|group)\s+(?:is\s+)?(?:called\s+)?["']?([A-Z][A-Za-z\s]+?)["']?(?:\s*[.,]|\s+(?:and|on|for|from)\b)/i,
  ];
  for (const pattern of artistPatterns) {
    const match = text.match(pattern);
    if (match) {
      artist = match[1].trim();
      break;
    }
  }

  // Extract album - use tight word boundaries
  let album: string | null = null;
  const albumPatterns = [
    /album\s+(?:is\s+)?(?:called|titled|named)\s+["']([^"']+)["']/i,
    /(?:on\s+the\s+album|album)\s+["']([^"']+)["']/i,
    /album\s+(?:is\s+)?(?:called|titled|named)\s+([A-Z][A-Za-z\s]+?)(?:\s*[.,]|\s+(?:on|by|and|for|from|the)\b)/i,
    /(?:on\s+the\s+album|album)\s+([A-Z][A-Za-z\s]+?)(?:\s*[.,]|\s+(?:on|by|and|for|from|the)\b)/i,
  ];
  for (const pattern of albumPatterns) {
    const match = text.match(pattern);
    if (match) {
      album = match[1].trim();
      break;
    }
  }

  // Extract record label
  let recordLabel: string | null = null;
  const labelPatterns = [
    /(?:record\s+)?label\s+(?:is\s+)?["']([^"']+)["']/i,
    /(?:record\s+)?label\s+(?:is\s+)?([A-Z][A-Za-z\s]+?)(?:\s*[.,]|\s*$)/im,
    /(?:on|released\s+(?:by|on|through))\s+["']?([A-Za-z\s]+?(?:Records|Music|Entertainment|Label))["']?/i,
    /([A-Za-z\s]+?(?:Records|Music|Entertainment))\b/i,
  ];
  for (const pattern of labelPatterns) {
    const match = text.match(pattern);
    if (match) {
      recordLabel = match[1].trim();
      break;
    }
  }

  // Build a set of extracted entities to exclude from contributor detection
  const entityNames = new Set<string>();
  if (title) entityNames.add(title.toLowerCase());
  if (artist) entityNames.add(artist.toLowerCase());
  if (album) entityNames.add(album.toLowerCase());
  if (recordLabel) entityNames.add(recordLabel.toLowerCase());

  // Extract contributors - look for names with associated roles
  const contributors: ParsedContributor[] = [];
  const foundNames = new Set<string>();

  const roleKeywords: Record<string, string> = {
    'songwriter': 'songwriter',
    'writer': 'songwriter',
    'wrote': 'songwriter',
    'written': 'songwriter',
    'writing': 'songwriter',
    'songwriting': 'songwriter',
    'composed': 'composer',
    'composer': 'composer',
    'lyricist': 'lyricist',
    'producer': 'producer',
    'produced': 'producer',
    'arranger': 'arranger',
    'arrangement': 'arranger',
    'drums': 'instrumentalist',
    'guitar': 'instrumentalist',
    'bass': 'instrumentalist',
    'piano': 'instrumentalist',
    'keyboard': 'instrumentalist',
    'keys': 'instrumentalist',
    'vocal': 'vocalist',
    'vocals': 'vocalist',
    'sang': 'vocalist',
    'singer': 'vocalist',
    'engineer': 'engineer',
    'mixed': 'engineer',
    'mixer': 'engineer',
    'session musician': 'session_musician',
  };

  // Find all proper names in the text (2+ word capitalized sequences)
  const nameMatches = text.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/g) || [];

  for (const name of nameMatches) {
    if (foundNames.has(name)) continue;
    // Skip if this name matches any extracted entity
    if (entityNames.has(name.toLowerCase())) continue;
    // Skip common non-name phrases
    if (/^(The|A|An|In|On|At|For|By|With)\s/i.test(name) && !text.includes(name + ' wrote') && !text.includes(name + ' produced')) continue;
    // Skip names that look like record labels (end with Records, Music, etc.)
    if (/(?:Records|Music|Entertainment|Label|Studios|Publishing)$/i.test(name)) continue;

    // Find the sentence containing this name (split on periods and semicolons)
    const nameIdx = text.indexOf(name);
    const sentenceBreaks = ['.', ';', '!', '?'];
    let sentenceStart = 0;
    for (const br of sentenceBreaks) {
      const idx = text.lastIndexOf(br, nameIdx);
      if (idx >= 0 && idx + 1 > sentenceStart) sentenceStart = idx + 1;
    }
    let sentenceEnd = text.length;
    for (const br of sentenceBreaks) {
      const idx = text.indexOf(br, nameIdx + name.length);
      if (idx >= 0 && idx < sentenceEnd) sentenceEnd = idx;
    }
    const sentence = text.substring(sentenceStart, sentenceEnd).toLowerCase();

    const roles: string[] = [];
    for (const [keyword, role] of Object.entries(roleKeywords)) {
      if (sentence.includes(keyword)) {
        if (!roles.includes(role)) roles.push(role);
      }
    }

    // Check if this person explicitly didn't make songwriting changes
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const noSongwritingPattern = new RegExp(escapedName + ".*(?:didn't|did not).*(?:songwriting|writing|compositional)", 'i');
    const noSongwriting = noSongwritingPattern.test(text);

    if (roles.length === 0) {
      if (sentence.includes('demo') || sentence.includes('chord') || sentence.includes('lyric') || sentence.includes('melody')) {
        roles.push('songwriter');
      } else {
        roles.push('contributor');
      }
    }

    // If explicitly not a songwriter, remove songwriter role
    if (noSongwriting) {
      const swIdx = roles.indexOf('songwriter');
      if (swIdx >= 0) roles.splice(swIdx, 1);
      if (roles.length === 0) roles.push('session_musician');
    }

    foundNames.add(name);
    for (const role of roles) {
      contributors.push({
        name,
        role,
        splitType: role === 'lyricist' ? 'lyrics' : 'music',
      });
    }
  }

  // Also try to find first-name-only references and link them to full names
  // e.g. "John wrote the music" where "John Smith" was already found
  for (const fullName of Array.from(foundNames)) {
    const firstName = fullName.split(' ')[0];
    const escapedFirst = firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Check for "<firstName> wrote the music/lyrics" patterns
    const musicPattern = new RegExp(`\\b${escapedFirst}\\b[^.]*(?:wrote|composed|created)[^.]*(?:music|melody|chords|instrumental)`, 'i');
    const lyricsPattern = new RegExp(`\\b${escapedFirst}\\b[^.]*(?:wrote|composed|created)[^.]*(?:lyrics|words|text)`, 'i');

    const didMusic = musicPattern.test(text);
    const didLyrics = lyricsPattern.test(text);

    if (didMusic || didLyrics) {
      // Find existing entries for this person and update their role/splitType
      const existingEntries = contributors.filter((c) => c.name === fullName);
      if (existingEntries.length > 0) {
        // Update the first entry with the appropriate type
        if (didMusic && !didLyrics) {
          existingEntries[0].splitType = 'music';
          if (existingEntries[0].role === 'contributor') existingEntries[0].role = 'songwriter';
        } else if (didLyrics && !didMusic) {
          existingEntries[0].splitType = 'lyrics';
          if (existingEntries[0].role === 'contributor') existingEntries[0].role = 'lyricist';
        }
        // Don't add duplicates
      }
    }
  }

  // Apply context overrides
  if (context) {
    if (context.album && !album) album = context.album;
    if (context.recordLabel && !recordLabel) recordLabel = context.recordLabel;
    if (context.artist && !artist) artist = context.artist;
    if (context.title && !title) title = context.title;
  }

  // Generate follow-up questions for missing data
  const followUpQuestions: string[] = [];
  if (!title) followUpQuestions.push('What is the song title?');
  if (!artist) followUpQuestions.push('Who is the artist or band?');
  if (!album) followUpQuestions.push('What album is this song on?');
  if (!recordLabel) followUpQuestions.push('What record label released this?');
  if (contributors.length === 0) followUpQuestions.push('Who are the songwriters and contributors?');

  // Calculate confidence
  let confidence = 0;
  if (title) confidence += 0.25;
  if (artist) confidence += 0.15;
  if (album) confidence += 0.1;
  if (recordLabel) confidence += 0.1;
  if (contributors.length > 0) confidence += 0.2;
  if (contributors.length > 1) confidence += 0.1;
  if (followUpQuestions.length === 0) confidence += 0.1;

  return {
    title,
    artist,
    album,
    recordLabel,
    contributors,
    followUpQuestions,
    confidence: Math.min(1, confidence),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { story, context } = body;

    if (!story || typeof story !== 'string' || story.trim().length === 0) {
      return NextResponse.json({ error: 'Story text is required' }, { status: 400 });
    }

    const result = parseStoryToSongData(story, context);

    return NextResponse.json({
      parsed: result,
      message: result.followUpQuestions.length > 0
        ? 'I found some information but have a few questions.'
        : 'Song data extracted successfully!',
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
