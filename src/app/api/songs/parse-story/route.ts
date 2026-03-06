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
  // Extract song title - look for patterns like "called X", "titled X", "song is X"
  let title: string | null = null;
  const titlePatterns = [
    /(?:song\s+(?:is\s+)?(?:called|titled|named)\s+)["']?([^"'\n,.]+)["']?/i,
    /(?:called|titled|named)\s+["']?([^"'\n,.]+)["']?/i,
    /["']([^"']+)["']\s+(?:by|from)/i,
    /the\s+song\s+["']?([^"'\n,.]+)["']?/i,
  ];
  for (const pattern of titlePatterns) {
    const match = text.match(pattern);
    if (match) {
      title = match[1].trim();
      break;
    }
  }

  // Extract artist/band
  let artist: string | null = null;
  const artistPatterns = [
    /by\s+(?:a\s+(?:band|artist|group|singer)\s+called\s+)["']?([^"'\n,.]+)["']?/i,
    /by\s+(?:the\s+)?(?:band|artist|group)\s+["']?([^"'\n,.]+)["']?/i,
    /by\s+["']?([A-Z][^"'\n,.]+)["']?/i,
  ];
  for (const pattern of artistPatterns) {
    const match = text.match(pattern);
    if (match) {
      artist = match[1].trim();
      break;
    }
  }

  // Extract album
  let album: string | null = null;
  const albumPatterns = [
    /album\s+(?:is\s+)?(?:called|titled|named)\s+["']?([^"'\n,.]+)["']?/i,
    /(?:on\s+the\s+album|album)\s+["']?([^"'\n,.]+)["']?/i,
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
    /(?:record\s+)?label\s+(?:is\s+)?["']?([^"'\n,.]+)["']?/i,
    /(?:on|released\s+(?:by|on|through))\s+["']?([^"'\n,.]+?)\s+(?:records|music|entertainment|label)/i,
    /["']?([^"'\n,.]+?)\s+(?:records|music|entertainment)\b/i,
  ];
  for (const pattern of labelPatterns) {
    const match = text.match(pattern);
    if (match) {
      recordLabel = match[1].trim();
      // Check for a second word in the label name
      const fullLabelMatch = text.match(new RegExp(match[1].trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+(?:Records|Music|Entertainment|Label)', 'i'));
      if (fullLabelMatch) {
        recordLabel = fullLabelMatch[0].trim();
      }
      break;
    }
  }

  // Extract contributors - look for names with associated roles
  const contributors: ParsedContributor[] = [];
  const foundNames = new Set<string>();

  // First pass: find names with explicit role mentions
  const roleKeywords: Record<string, string> = {
    'songwriter': 'songwriter',
    'writer': 'songwriter',
    'wrote': 'songwriter',
    'writing': 'songwriter',
    'songwriting': 'songwriter',
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
  // Filter out common non-name phrases
  const nonNames = new Set(['The Healing', 'The Album', 'The Song', 'The Band', 'The Record']);

  for (const name of nameMatches) {
    if (nonNames.has(name) || foundNames.has(name)) continue;
    if (name === title || name === artist || name === album) continue;

    // Find the sentence containing this name
    const nameIdx = text.indexOf(name);
    const sentenceStart = Math.max(0, text.lastIndexOf('.', nameIdx) + 1);
    const sentenceEnd = text.indexOf('.', nameIdx + name.length);
    const sentence = text.substring(sentenceStart, sentenceEnd > 0 ? sentenceEnd : text.length).toLowerCase();

    const roles: string[] = [];
    for (const [keyword, role] of Object.entries(roleKeywords)) {
      if (sentence.includes(keyword)) {
        if (!roles.includes(role)) roles.push(role);
      }
    }

    // Check if this person explicitly didn't make songwriting changes
    const noSongwritingPattern = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ".*(?:didn't|did not|didn't).*(?:songwriting|writing|compositional)", 'i');
    const noSongwriting = noSongwritingPattern.test(text);

    if (roles.length === 0) {
      // Default to songwriter if mentioned in a songwriting context
      if (sentence.includes('demo') || sentence.includes('wrote') || sentence.includes('chord') || sentence.includes('lyric') || sentence.includes('melody')) {
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
        splitType: role === 'songwriter' || role === 'composer' || role === 'lyricist' ? 'music' : 'music',
      });
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
