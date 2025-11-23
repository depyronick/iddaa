import { NextResponse } from 'next/server';
import { matchesService } from '@/lib/services/matches';

export async function GET(request: Request) {
  try {
    const payload = await matchesService.getPayload(request);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
