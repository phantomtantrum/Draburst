import { connection } from 'next/server';
import { z } from 'zod';
import { searchAssets } from '@/lib/market/server';
import { errorResponse } from '@/lib/market/respond';
import { MarketError } from '@/lib/market/types';

const Query = z.object({
  q: z.string().trim().min(1).max(32),
  cls: z.enum(['crypto', 'stock']),
});

/** GET /api/market/search?q=sol&cls=crypto → { results: Asset[] } */
export async function GET(req: Request) {
  await connection(); // per-request: never prerender
  try {
    const q = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!q.success) throw new MarketError('BAD_REQUEST', 'Expected ?q=<text>&cls=crypto|stock');
    const results = await searchAssets(q.data.cls, q.data.q.toUpperCase());
    return Response.json({ results }, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
  } catch (e) {
    return errorResponse(e);
  }
}
