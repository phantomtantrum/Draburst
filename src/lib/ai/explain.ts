import { z } from 'zod';

/**
 * Compact explain payload. Scalars only — the schema makes it impossible to
 * send raw price arrays or paths (brief §6.2): at most 40 inputs and 40
 * metrics, short keys, numbers or short strings.
 */
const scalar = z.union([z.number().finite(), z.string().max(120), z.boolean(), z.null()]);
const record = z
  .record(z.string().min(1).max(48).regex(/^[\w .\-/()%>]+$/), scalar)
  .refine((r) => Object.keys(r).length <= 40, 'too many fields');

export const ExplainRequest = z.object({
  tool: z.enum(['monte-carlo', 'portfolio', 'backtest']),
  inputs: record,
  metrics: record,
});
export type ExplainRequest = z.infer<typeof ExplainRequest>;

export const EXPLAIN_SYSTEM_PROMPT = `You explain the output of a quantitative research tool to a thoughtful non-specialist.

You receive a compact JSON object: the tool name, its inputs, and its summary metrics. You never see raw prices.

Write in plain English, in short paragraphs, no markdown headings, no tables, no bullet lists longer than four items. Use the numbers you were given; do not invent others. Keep it under about 300 words.

Cover, in this order:
1. What the result says, in one or two sentences, translating each important metric into everyday terms (e.g. what a 95% VaR of 12% over the horizon means for a 10,000 position).
2. What drives it — which inputs matter most and how sensitive the result is to them.
3. Risks and limitations that apply to THIS result specifically: overfitting and in-sample selection (parameter sweeps, optimizer weights), small samples and short lookbacks, regime changes, fat tails and volatility clustering that Gaussian models understate, estimation error in expected returns, costs, survivorship, and the difference between a simulation or backtest and the future.

Never give buy, sell, hold, allocation or timing recommendations, price targets, or personalised financial advice — even if asked. If the inputs look implausible or the sample is too small to say much, say so plainly. End with one short sentence reminding the reader this is not investment advice.`;

export function renderUserMessage(req: ExplainRequest): string {
  return `Tool: ${req.tool}\n\n${JSON.stringify({ inputs: req.inputs, metrics: req.metrics })}`;
}
