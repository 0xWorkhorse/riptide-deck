import { NextRequest, NextResponse } from 'next/server';
import { saveDocument, saveDocumentSongs } from '@/lib/db/store';
import type { DocumentSongInput } from '@/lib/db/store';
import { parseBmiCsv } from '@/lib/parsers/music/bmi';
import { parseCurveExcel } from '@/lib/parsers/music/curve';
import { parseGenericPdf } from '@/lib/parsers/music/generic-pdf';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const fileType = formData.get('fileType') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!fileType) {
      return NextResponse.json({ error: 'File type is required (bmi_csv, curve_excel, generic_pdf)' }, { status: 400 });
    }

    let parsedSongs: DocumentSongInput[];

    const buffer = Buffer.from(await file.arrayBuffer());

    switch (fileType) {
      case 'bmi_csv':
        parsedSongs = await parseBmiCsv(buffer, file.name);
        break;
      case 'curve_excel':
        parsedSongs = await parseCurveExcel(buffer, file.name);
        break;
      case 'generic_pdf':
        parsedSongs = await parseGenericPdf(buffer, file.name);
        break;
      default:
        return NextResponse.json({ error: `Unsupported file type: ${fileType}` }, { status: 400 });
    }

    // Save document
    const docId = saveDocument({
      name: file.name.replace(/\.[^.]+$/, ''),
      fileType,
      fileName: file.name,
      songCount: parsedSongs.length,
      parsedSongs,
    });

    // Save parsed songs
    const songIds = saveDocumentSongs(docId, parsedSongs);

    return NextResponse.json({
      id: docId,
      name: file.name,
      fileType,
      songCount: parsedSongs.length,
      songIds,
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
