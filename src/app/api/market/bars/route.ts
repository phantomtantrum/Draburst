import { connection } from 'next/server';
import { z } from 'zod';
import { getDailyBars } from '@/lib/market/server';
import { errorResponse } from '@/lib/market/respond';
import { MarketError, parseAssetId } from '@/lib/market/types';

const Query = z.object({
  id: z.string().min(3).max(24),
  years: z.coerce.number().int().min(1).max(15).default(5),
});

/** GET /api/market/bars?id=crypto:BTC&years=5 → BarsResponse */
export async function GET(req: Request) {
  await connection(); // per-request: never prerender
  try {
    const url = new URL(req.url);
    const q = Query.safeParse(Object.fromEntries(url.searchParams));
    if (!q.success) throw new MarketError('BAD_REQUEST', 'Expected ?id=<crypto|stock>:<SYMBOL>&years=1..15');
    const asset = parseAssetId(q.data.id);
    if (!asset) throw new MarketError('BAD_REQUEST', `Invalid asset id "${q.data.id}"`);
    const data = await getDailyBars(asset.cls, asset.symbol, q.data.years);
    return Response.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=21600' },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
