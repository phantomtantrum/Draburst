/** Public Supabase settings (inlined at build). Missing → auth features show a "not configured" state. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const supabaseConfigured = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

export type ToolId = 'monte-carlo' | 'portfolio' | 'backtest';

export interface SavedRun {
  id: string;
  user_id: string;
  tool: ToolId;
  name: string;
  params: string;
  summary: Record<string, string | number | null>;
  seed: number | null;
  created_at: string;
  updated_at: string;
}
