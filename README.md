# quantphantom

A quant research terminal designed by a gallery. It runs real market data through a tested quant engine and renders the results in strictly black-and-white WebGL, so every number on screen can become a sculpture.

- **01 Monte Carlo**: GBM or a block bootstrap of real history; percentile bands, target probabilities, VaR/CVaR at horizon; a volumetric 3D fan of paths.
- **02 Portfolio**: 2–20 crypto and stock assets on an aligned calendar; sample or Ledoit–Wolf covariance; min-variance, max-Sharpe, equal-weight and custom portfolios; risk contribution; a 3D risk × return × Sharpe cloud and a correlation bar field.
- **03 Backtest**: parameterized strategies with no look-ahead (signal on close, fill on next open), costs, sizing, stop-loss, monthly rebalancing; equity ribbon and a clickable 3D Sharpe sweep surface.
- **Home**: a live market sculpture driven by Binance WebSocket ticks. Scrolling morphs it into the three tools' shapes.
- **Accounts** (Supabase): save runs as inputs + seed + summary, dashboard, row-level security.
- **Explain** (Claude): a streamed plain-English reading of each result, never buy/sell advice.

> Not investment advice. Simulations and backtests are hypothetical.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # every variable is optional
npm run dev                    # http://localhost:3000
```

With **no keys at all**, crypto tools, the live sculpture and all 3D work. Stocks, accounts and Explain show a clear "not configured" state until you add their keys.

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js (Turbopack) |
| `npm run lint` | ESLint + `scripts/check-monochrome.mjs` (fails on any color literal with hue, or chromatic Tailwind classes) |
| `npm run typecheck` | `tsc --noEmit` (strict, `noUncheckedIndexedAccess`) |
| `npm test` | Vitest: quant engine, data layer, payload schemas |
| `npm run e2e` | Playwright smoke tests against a production build with fixture data (run `npm run build` first) |
| `npm run db:test` | Applies the migrations to a throwaway PostgreSQL and tests the RLS policies + AI quota (needs local `postgres` binaries) |
| `npm run reference` | Regenerates `src/lib/quant/__fixtures__/reference.json` with NumPy/SciPy/scikit-learn |
| `npm run check` | lint + typecheck + test + build |

---

## Environment variables

All of them are documented in [`.env.example`](.env.example). Secrets are only ever read in server code (route handlers, `server-only` modules).

| Variable | Needed for | Notes |
|---|---|---|
| `TIINGO_API_KEY` | Stocks & ETFs | Server-only, sent as an `Authorization` header and never in URLs |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Accounts, saving, dashboard, Explain | Public by design; protection comes from RLS |
| `ANTHROPIC_API_KEY` | Explain | Server-only |
| `ANTHROPIC_MODEL` | optional | Defaults to `claude-sonnet-5-5` |
| `EXPLAIN_DAILY_LIMIT` | optional | Explanations per user per UTC day (default 20) |
| `NEXT_PUBLIC_SITE_URL` | Auth redirects, metadata | e.g. `https://quantphantom.vercel.app` |
| `MARKET_DATA_MODE` | **tests only** | `fixture` serves deterministic synthetic bars (labelled DEMO in the UI). It is ignored when `VERCEL_ENV=production` |

---

## Market data

Every request goes through `src/lib/market` → `MarketDataProvider`, and the UI only talks to `/api/market/*`.

| Asset class | Provider | Free tier (checked Nov 2026) | Why |
|---|---|---|---|
| Crypto | **Binance** public market data via `data-api.binance.vision` (REST) and `data-stream.binance.vision` (WebSocket) | No key; weight-based limits | These market-data-only mirrors stay reachable where `api.binance.com` answers HTTP 451 |
| Stocks / ETFs | **Tiingo** end-of-day | ≈ 50 req/h, 1,000 req/day, 500 unique symbols/month, **personal use** | Split- **and** dividend-adjusted OHLC with decades of history. Alpha Vantage's free tier (25 req/day) has no adjusted daily series; Massive/Polygon free has 2 years of history |
| Metadata | **CoinGecko** | Public API | Fallback names/ranks |

**Caching.** Daily bars live in Next.js `'use cache'` with `cacheLife`: revalidated every 3 h (crypto) or 6 h (stocks), expired after 2 days without traffic, and given CDN `s-maxage` headers. Search results are cached for a day. Failures are cached for less than a minute, which also throttles retries while a vendor rate-limits. Upstream calls retry 429/5xx with exponential backoff that honours `Retry-After`. The UI shows rate-limit, not-configured and stale states with retry buttons.

**Attribution & ToS.** Each tool shows its source, an `EOD`/`LIVE`/`DEMO` chip and the fetch time. Tiingo's free plan is for personal use; a public, commercial deployment needs a Tiingo commercial licence (or another provider behind the same interface).

---

## Deploy (Vercel + Supabase, free tiers)

### 1. Supabase

1. Create a project at <https://supabase.com/dashboard>.
2. **SQL → New query**: paste and run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). With the CLI you can instead run `supabase link` then `supabase db push`. This creates:
   - `saved_runs`, with RLS policies for select/insert/update/delete own rows;
   - `ai_usage`, plus the `consume_ai_quota(daily_limit)` function (SECURITY DEFINER, scoped to `auth.uid()`).
3. **Authentication → URL configuration**:
   - Site URL: `https://<your-domain>`
   - Redirect URLs: `https://<your-domain>/auth/callback` (add `http://localhost:3000/auth/callback` for local dev)
4. **Authentication → Providers**:
   - **Email**: enable (magic link).
   - **Google**: create an OAuth client in Google Cloud Console → Credentials, with authorized redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`. Paste the client ID and secret into Supabase.
   - **GitHub**: GitHub → Settings → Developer settings → OAuth Apps → New, with callback URL `https://<project-ref>.supabase.co/auth/v1/callback`. Paste the client ID and secret into Supabase.
5. Copy **Project URL** and **anon public key** (Settings → API) into the env vars. No service-role key is used anywhere.

Free-tier note: inactive free Supabase projects pause after about a week.

### 2. Keys

- Tiingo: <https://www.tiingo.com> → Account → API token → `TIINGO_API_KEY`.
- Anthropic: <https://console.anthropic.com> → API keys → `ANTHROPIC_API_KEY`.

### 3. Vercel

1. Import the repository. The framework preset is Next.js, and no build settings need changing.
2. Add the environment variables above (Production + Preview). Do **not** set `MARKET_DATA_MODE`.
3. `vercel.json` pins functions to **`fra1`** (Frankfurt): Binance refuses US data-centre IPs.
4. Deploy, then open `/api/market/status` to confirm which providers are configured.

Free-tier note: Vercel Hobby is for non-commercial use.

---

## Architecture

```
src/
  app/                    routes (App Router, Cache Components on)
    page.tsx              home: live sculpture + scroll intro (app/_home)
    tools/{monte-carlo,portfolio,backtest}/
    methodology/  dashboard/  login/  auth/{callback,signout}/
    api/market/{bars,search,status}   api/explain
  components/
    ui/        primitives (Button, Field, Segmented, DataTable, Delta, Drawer…)
    charts/    monochrome SVG/Canvas charts (fan, histogram, frontier, heatmaps…)
    three/     R3F scenes + PhantomEffect (luma-only Bayer dither + grain pass)
    tool/      ToolShell, ToolHeader, AssetPicker, Save/Explain actions
  lib/
    quant/     pure TS engine + tests (prng, stats, metrics, risk, covariance,
               optimize, montecarlo, indicators, backtest, portfolio, strategies)
    market/    provider interface, Binance/Tiingo/CoinGecko/fixture, cache, align
    live/      Binance WebSocket store, correlation layout (MDS)
    supabase/  browser/server clients, auth hook
    ai/        explain schema + system prompt
  workers/     Monte Carlo, portfolio and backtest workers (Comlink, transferables)
  proxy.ts     Supabase session refresh (Next 16 "proxy", formerly middleware)
supabase/      migrations + RLS tests
design-system/quantphantom/   MASTER.md + per-page overrides (read before building UI)
```

**Stack choices.**

| Choice | Why |
|---|---|
| Next.js 16 + TypeScript strict | Server route handlers keep keys off the client |
| Tailwind v4 | The default palette is removed, so only neutral tokens exist |
| React Three Fiber + custom GLSL | Instanced meshes, points and line segments for more than 1k objects |
| Comlink workers | All heavy math is off the main thread |
| GSAP ScrollTrigger | Observes native scroll; drei `ScrollControls` would hijack scrolling |
| d3-scale / d3-shape + hand-written SVG/Canvas | Full control over hatching and dithering |
| KaTeX rendered on the server | Formulas without client JS |
| Supabase | Auth + Postgres with native RLS |

**Design system.** `design-system/quantphantom/MASTER.md` was generated with UI/UX Pro Max and then overridden to the hard rules below:

- monochrome only, enforced by lint;
- gain/loss shown by sign, glyph (▲▼), solid vs dashed, and hatching;
- Inter Tight for display × JetBrains Mono for every number;
- 0 px radius, hairlines, mechanical motion, film grain and Bayer dither.

**Performance & accessibility.**
- **3D stage behaviour:**
  - the 3D bundle is lazy-loaded;
  - DPR adapts and `PerformanceMonitor` degrades quality;
  - rendering pauses offscreen or when the tab is hidden;
  - GPU resources are disposed on unmount.
- **Reduced motion and low-end devices:** with `prefers-reduced-motion` or low-end hardware the stage renders statically on demand. CPU-only WebGL (SwiftShader/llvmpipe) shows the 2D companions only, with a "Render 3D anyway" opt-in. Without WebGL, the page is 2D only.
- **2D coverage:** every 3D insight also exists as a 2D chart or table.
- **Lighthouse,** measured in CI-like conditions (mobile, simulated throttling, no GPU):

  | Page | Performance | Accessibility | Best practices |
  |---|---|---|---|
  | Tool pages | 85–88 | 100 | 100 |
  | Methodology | 93 | 100 | 100 |
  | Dashboard | 96 | 100 | 100 |

  On machines with a GPU the tools render 3D, and the Performance score will vary with the GPU.

---

## Testing & correctness

- **Quant engine:** checked against NumPy, SciPy and scikit-learn references (`scripts/reference`), plus hand-computed examples.
  - Ledoit–Wolf matches scikit-learn to 1e−15.
  - The optimizer matches closed forms and SciPy SLSQP with binding constraints.
  - RSI matches the StockCharts/Wilder worked example.
  - GBM Monte Carlo converges to the lognormal closed form.
  - The PRNG sequence is snapshot-locked, so saved seeds replay.
- **No-look-ahead:** tests mutate bar *t* and assert that the position held during bar *t* is unchanged, and that signals on a prefix equal signals on the full series.
- **Database:** RLS tests run on a real PostgreSQL. They cover cross-user isolation, spoofed inserts, CHECK constraints, the daily AI quota and anonymous rejection.
- **E2E:** desktop and mobile flows, URL-state round-trips, seeded reproducibility, no horizontal scroll at phone width, and not-configured states.

---

## Limitations

See [`/methodology#limitations`](src/app/methodology/page.tsx):

- one historical sample path, and noisy expected returns;
- Gaussian models understate fat tails;
- crypto and equity closes are 3–4 h apart;
- no taxes, borrow costs or liquidity effects;
- sweeps are in-sample.

---

Author notes from the original repository README are preserved in [`docs/about-author.md`](docs/about-author.md).
