import { connection } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getServerSupabase } from '@/lib/supabase/server';
import { EXPLAIN_SYSTEM_PROMPT, ExplainRequest, renderUserMessage } from '@/lib/ai/explain';

/**
 * POST /api/explain — streams a plain-English explanation of a tool result.
 * Logged-in users only; per-user daily quota enforced in Postgres
 * (consume_ai_quota, scoped to auth.uid()); API key never leaves the server.
 */
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const DAILY_LIMIT = Math.max(1, Number(process.env.EXPLAIN_DAILY_LIMIT) || 20);

const json = (status: number, code: string, message: string, extra: Record<string, string> = {}) =>
  Response.json({ error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store', ...extra } });

export async function POST(req: Request) {
  await connection();
  if (!process.env.ANTHROPIC_API_KEY) return json(503, 'NOT_CONFIGURED', 'AI explanations are not configured on this deployment.');
  const supabase = await getServerSupabase();
  if (!supabase) return json(503, 'NOT_CONFIGURED', 'Accounts are not configured on this deployment.');

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return json(401, 'UNAUTHENTICATED', 'Sign in to request explanations.');

  const raw = await req.text();
  if (raw.length > 8_000) return json(413, 'TOO_LARGE', 'Payload too large — send summary metrics only.');
  let body: ExplainRequest;
  try {
    const parsed = ExplainRequest.safeParse(JSON.parse(raw));
    if (!parsed.success) return json(400, 'BAD_REQUEST', 'Invalid explain payload.');
    body = parsed.data;
  } catch {
    return json(400, 'BAD_REQUEST', 'Body must be JSON.');
  }

  const { data: remaining, error: quotaError } = await supabase.rpc('consume_ai_quota', { daily_limit: DAILY_LIMIT });
  if (quotaError) {
    console.error('[explain] quota', quotaError.message);
    return json(503, 'QUOTA_UNAVAILABLE', 'Could not check your daily quota. Try again shortly.');
  }
  if (typeof remaining === 'number' && remaining < 0) {
    return json(429, 'RATE_LIMITED', `Daily limit of ${DAILY_LIMIT} explanations reached. It resets at 00:00 UTC.`);
  }

  const client = new Anthropic();
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 16_000,
    // refusals are re-run server-side on Anthropic's recommended fallback model
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium' },
    system: EXPLAIN_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: renderUserMessage(body) }],
  });

  const encoder = new TextEncoder();
  const out = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') controller.enqueue(encoder.encode(event.delta.text));
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === 'refusal') controller.enqueue(encoder.encode('\n\n[The model declined to explain this result.]'));
        else if (final.stop_reason === 'max_tokens') controller.enqueue(encoder.encode('\n\n[Explanation truncated.]'));
      } catch (e) {
        const msg =
          e instanceof Anthropic.RateLimitError
            ? 'The AI service is busy. Try again in a minute.'
            : e instanceof Anthropic.APIError
              ? `AI service error (${e.status ?? 'network'}).`
              : 'AI service error.';
        if (!(e instanceof Anthropic.APIError)) console.error('[explain]', e);
        controller.enqueue(encoder.encode(`\n\n[${msg}]`));
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(out, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Explain-Remaining': String(remaining ?? ''),
      'X-Explain-Model': MODEL,
    },
  });
}
