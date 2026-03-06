import { NextResponse } from 'next/server';
import { getDashboardStats } from '@/lib/db/store';

export async function GET() {
  try {
    const stats = getDashboardStats();
    return NextResponse.json(stats);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
