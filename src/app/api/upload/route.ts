import { NextResponse, NextRequest } from 'next/server';
import { parseFile, SUPPORTED_EXTENSIONS } from '@/lib/parsers/index';
import { saveDataset } from '@/lib/db/store';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name;
    const options: Record<string, unknown> = {};

    // Parse optional settings from form data
    const sheet = formData.get('sheet') as string | null;
    if (sheet) options.sheet = isNaN(Number(sheet)) ? sheet : Number(sheet);

    const delimiter = formData.get('delimiter') as string | null;
    if (delimiter) options.delimiter = delimiter;

    const dataPath = formData.get('dataPath') as string | null;
    if (dataPath) options.dataPath = dataPath;

    const parsed = await parseFile(buffer, filename, options);

    // Save to local store
    const id = saveDataset({
      name: filename,
      sourceType: 'file',
      sourceName: filename,
      columns: parsed.columns,
      rows: parsed.rows,
      rowCount: parsed.rowCount,
      metadata: {
        errors: parsed.errors,
        sheets: parsed.sheets,
      },
    });

    return NextResponse.json({
      id,
      name: filename,
      columns: parsed.columns,
      rowCount: parsed.rowCount,
      preview: parsed.rows.slice(0, 5),
      errors: parsed.errors,
      sheets: parsed.sheets,
    });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    supportedExtensions: SUPPORTED_EXTENSIONS,
    maxFileSize: '50MB',
  });
}
