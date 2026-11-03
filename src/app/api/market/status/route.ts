import { connection } from 'next/server';
import { providerStatus } from '@/lib/market/registry';

/** GET /api/market/status → which providers are configured (no secrets). */
export async function GET() {
  await connection();
  return Response.json(providerStatus(), { headers: { 'Cache-Control': 'no-store' } });
}
