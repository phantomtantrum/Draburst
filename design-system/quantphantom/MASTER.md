# quantphantom — Design System MASTER

> **Retrieval rule:** before building any page, read this file, then
> `design-system/quantphantom/pages/<page>.md`. Page rules override MASTER
> only where they explicitly say so; the **Hard Constraints** below can never
> be overridden.

**Project:** quantphantom — a research terminal designed by a gallery.
**Generated:** 2026-11-03 via UI/UX Pro Max (`--design-system`), then
**manually overridden** per the build brief §1.

### What the skill suggested vs. what we use

| Skill output (rejected) | Why rejected | Override |
|---|---|---|
| Style: *Cyberpunk UI* — neon, glow, glitch | Neon crypto aesthetic is a forbidden anti-pattern | Swiss Minimalism × Brutalism, monochrome, "phantom" noise textures |
| Palette: `#00FF41` matrix green, `#FF3333` red, slate grays `#94A3B8` | Zero hue allowed; tinted grays forbidden | Pure `#000` / `#FFF` + neutral gray ramp (R = G = B) |
| Fonts: Fira Code + Fira Sans | Need a *sharp display grotesk* + monospace | Inter Tight (display/UI) + JetBrains Mono (numbers/labels) |
| Radii 8–16px, soft shadows, `backdrop-filter: blur` modals | "Rounded friendly SaaS cards" + glassmorphism forbidden | 0px radius, no shadows, opaque surfaces, 1px hairlines |
| `translateY(-1px)` hover lifts, `transition: all 200ms ease` | Must be crisp and mechanical, not bouncy | Step / linear-out curves, 80–160ms, no lift |
| "Avoid light mode" | Light (inverted) theme is an allowed bonus | Dark default, inverted light theme optional |

Kept from the skill: WCAG contrast ≥ 4.5:1, visible focus, reduced-motion,
SVG icons only, 375/768/1024/1440 breakpoints, "label telemetry as live only
when backed by a current source, with update time and stale state",
pause/hide for tickers, stop offscreen work, static snapshot under reduced
motion, chart guidance "never distinguish series by hue alone; use
solid/dashed/dotted styles + direct labels + a visible data table".

---

## 1. Hard Constraints (non-negotiable)

1. **Monochrome UI + one semantic pair.** `#000`, `#FFF` and the neutral
   ramp in §2 for everything structural (surfaces, text, rules, focus,
   selection, icons). The **only** hues are `--gain` (green) and `--loss`
   (red), used strictly to mean gain / loss / error / live (§2.1, §6). No
   decorative color. Lint rule: any chromatic literal outside
   `src/styles/tokens.css` fails CI; components use `var(--gain)` /
   `var(--loss)` or the `text-gain` / `text-loss` / `bg-gain` utilities.
2. **Gain/loss never by color alone** — color is always paired with sign,
   glyph or line style (§6), so it still reads in grayscale and for
   color-blind users.
3. **No:** glassmorphism, backdrop blur, neon/glow halos, purple/pink AI
   gradients, colored gradients, emoji, stock illustration, device mockups,
   rounded cards, drop shadows, bouncy/spring easing.
4. **Icons:** Lucide (stroke 1.25–1.5px, `currentColor`), `aria-hidden` when
   decorative; icon-only buttons need `aria-label`.
5. **Language:** English UI copy. Numbers in `en-US` formatting.
6. **"Not investment advice"** visible on every tool page (footer + near results).

---

## 2. Color Tokens

Neutral ramp (all R = G = B). Contrast measured against `#000`.

| Token | Hex | On `#000` | Allowed use |
|---|---|---|---|
| `--qp-black` | `#000000` | — | page background (dark) |
| `--qp-gray-950` | `#0A0A0A` | — | raised surface (panels, drawers) |
| `--qp-gray-900` | `#111111` | — | input fields, table zebra |
| `--qp-gray-850` | `#171717` | — | hover fill |
| `--qp-gray-800` | `#1F1F1F` | — | hairline rules (default) |
| `--qp-gray-700` | `#2E2E2E` | — | strong rules, grid lines in charts |
| `--qp-gray-600` | `#474747` | — | disabled borders, chart minor ticks |
| `--qp-gray-500` | `#6B6B6B` | 3.9:1 | **non-text only** (axis lines, large ≥24px display) |
| `--qp-gray-400` | `#8A8A8A` | 6.1:1 | **minimum for any text** (metadata, captions) |
| `--qp-gray-300` | `#B0B0B0` | 9.6:1 | secondary text |
| `--qp-gray-200` | `#D4D4D4` | 14:1 | body text |
| `--qp-gray-100` | `#EDEDED` | 18:1 | emphasized text |
| `--qp-white` | `#FFFFFF` | 21:1 | primary text, active, focus, frontier ridge |

Semantic tokens (dark default):

```css
:root, [data-theme="dark"] {
  --bg: var(--qp-black);
  --surface: var(--qp-gray-950);
  --surface-2: var(--qp-gray-900);
  --fg: var(--qp-white);
  --fg-body: var(--qp-gray-200);
  --fg-muted: var(--qp-gray-400);   /* never below this for text */
  --rule: var(--qp-gray-800);
  --rule-strong: var(--qp-gray-700);
  --focus: var(--qp-white);
  --selection-bg: var(--qp-white);
  --selection-fg: var(--qp-black);
}
[data-theme="light"] {               /* optional inverted theme */
  --bg: #FFFFFF; --surface: #F5F5F5; --surface-2: #EDEDED;
  --fg: #000000; --fg-body: #2E2E2E; --fg-muted: #5E5E5E; /* 7:1 on #FFF */
  --rule: #E0E0E0; --rule-strong: #C7C7C7; --focus: #000000;
  --selection-bg: #000000; --selection-fg: #FFFFFF;
}
```

### 2.1 Semantic gain / loss (the only hues)

| Token | Dark | Light | Contrast | Use |
|---|---|---|---|---|
| `--gain` | `#3CCF8E` | `#0A7D48` | 10.5:1 / 5.2:1 | positive values, ▲, LIVE, heatmap gain cells, paths ≥ S₀ |
| `--loss` | `#FF5C5C` | `#C8102E` | 6.9:1 / 5.9:1 | negative values, ▼, errors, drawdown, heatmap loss cells, paths < S₀ |

Dark theme base is **true black, flat**: `--bg #000000`, `--surface
#0B0B0B`, `--surface-2 #131313`, rules `#1F1F1F` / `#2E2E2E`, `--fg
#F5F5F5`. No film grain and no dither textures on backgrounds; the
3D post pass keeps the canvas background flat at `--bg`.

Heatmap cells: `--surface-2` base + the hue at `fill-opacity` 0.1–0.55
proportional to |value|, value printed in `--fg` (stays ≥ 4.5:1 in both
themes). Text tokens were raised for readability: `--fg-muted` `#A3A3A3`
(8.4:1), `--fg-subtle` `#7A7A7A` (non-text). Grain opacity 1.8%.

3D (not yet migrated): scene clear color = `--bg`; all materials are grayscale (`color` with
r = g = b), additive white for density. Post-processing must not introduce
hue (no chromatic aberration). A final `Monochrome` pass (luma only) runs
last as a safety net.

---

## 3. Typography

**Pairing: Inter Tight (display + UI) × JetBrains Mono (data).**

- *Inter Tight* — the Swiss-neutral grotesk Inter, re-spaced for display
  sizes; tight default spacing survives −0.04em tracking at 120px+ without
  letters colliding; large x-height reads cleanly in UI at 14–16px. Neutral
  enough to let data be the subject (gallery wall label), sharp enough at
  weight 700–800 to be the "sculpture plinth" headline.
- *JetBrains Mono* — true tabular figures, slashed zero, distinct `0/O`,
  `1/l/I`, `−` vs `-`; designed for long reading of code → tickers, prices,
  seeds, coordinates. Ligatures **off** (`font-variant-ligatures: none`).
- Rejected: Space Grotesk (quirky forms fight the Swiss grid), Fira (skill
  default, humanist/soft), Geist (default Next.js look, generic).
- Load via `next/font/google`, `display: swap`, subsets `latin`, variable axes.

| Token | Family | Size / line-height | Tracking | Weight | Use |
|---|---|---|---|---|---|
| `display-xl` | Inter Tight | clamp(44px, 8vw, 112px) / 0.95 | −0.04em | 800 | hero word |
| `display-l` | Inter Tight | clamp(32px, 4vw, 52px) / 1.05 | −0.03em | 700 | page title |
| `display-m` | Inter Tight | clamp(24px, 2.4vw, 34px) / 1.1 | −0.02em | 700 | section title |
| `title` | Inter Tight | 20px / 1.2 | −0.01em | 600 | panel headers |
| `body` | Inter Tight | 16px / 1.55 | 0 | 400 | prose |
| `small` | Inter Tight | 14px / 1.45 | 0 | 400 | help text |
| `num-xl` | JetBrains Mono | clamp(32px, 4vw, 64px) / 1.0 | −0.02em | 500 | KPI value |
| `num` | JetBrains Mono | 14px / 1.4 | 0 | 400 | tables, inputs |
| `ui-label` | Inter Tight | 14px / 1.35 | 0, sentence case | 500 | field labels, buttons, nav, segmented options, table headers |
| `label` | JetBrains Mono | 12px / 1.35 | +0.05em, UPPERCASE | 500 | machine metadata only: status chips, readouts, axis captions, `01 / MONTE CARLO` |

Rules: **all numbers in JetBrains Mono** with
`font-variant-numeric: tabular-nums slashed-zero`; minus sign is U+2212 `−`;
right-align numeric columns; fixed decimals per column. Body text ≥ 14px;
anything a person reads to operate the tool (labels, buttons, help,
disclaimers) uses `ui-label` / body, never uppercase mono.

---

## 4. Layout & Grid

- 12-column grid, `max-width: 1600px`, gutters 24px (≥1024), 16px (<1024).
  Mobile: 4 columns, 16px side gutter, **no horizontal page scroll**.
- Spacing scale (4px base): 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.
  Tool pages are dense (8–32); marketing sections spacious (48–128).
- **Hairlines:** 1px `--rule`; section dividers 1px `--rule-strong`. No boxes
  with fill + border + radius: panels are delimited by rules, not cards.
- **Radius: 0px everywhere.** Only exception: circular data markers.
- **Numbered sections:** `01 / MONTE CARLO` as `label` token, preceded by a
  12px hairline tick. Every page has an index.
- **Instrument metadata:** each 3D stage/chart carries corner readouts
  (e.g. `N=10,000  SEED 0x3F2A  T+252D  SRC BINANCE · EOD`), crosshair
  coordinates, frame counter / fps in dev.
- **Breakpoints:** 375, 768, 1024, 1440. Tool layout: ≥1024 control panel
  left (320px) + stage; <1024 stage on top, controls in a bottom sheet/drawer.

---

## 5. Motion

- **Library:** GSAP (+ ScrollTrigger) for DOM and scroll; R3F `useFrame`
  reads a shared scroll-progress store for 3D. No drei `ScrollControls`
  (it hijacks native scroll and breaks DOM sections/a11y).
- **Character:** mechanical. Easing `steps(n)` for "static resolve",
  `power2.out` / `expo.out` for movement, `linear` for scrubs. **No springs,
  no overshoot, no elastic/back.**
- Durations: micro 80ms, small 120ms, panel 160–240ms, exit 70% of enter.
  Never `transition: all`; animate `opacity`/`transform` only.
- **Resolve-from-static** (brand signature): text and charts appear by a
  dither/scramble pass (≤400ms) on mount and on scroll into view; numbers
  "count" through random digits to the final value (≤300ms).
- `prefers-reduced-motion: reduce` → no scramble, no scroll-linked 3D,
  static dithered render; state changes become instant crossfades ≤80ms.

---

## 6. Gain / Loss / State Encoding (2D and 3D)

| Meaning | Text | Glyph | Line | Fill / Mark | 3D |
|---|---|---|---|---|---|
| Positive / gain | `+1.24%` in `--gain` | ▲ | solid, 1.5px, `--gain` | solid `--gain` | solid opaque mesh / filled point |
| Negative / loss | `−1.24%` in `--loss` | ▼ | **dashed** 4-3, 1.5px, `--loss` | `--loss` tint or hatch | wireframe / outlined point / dither-shaded |
| Neutral / zero | `0.00%` | ◆ | dotted 1-2 | gray-400 fill | gray mid-luma |
| Benchmark | label `BENCH` | — | dotted 1-3, 1px | none | thin line |
| Drawdown | `−` | — | `--loss` 1px | `--loss` at 16% | carved void (negative extrusion), dither texture |
| Selected / active | — | ■ | 2.5px white | inverted (white bg, black fg) | white emissive ridge (no bloom halo beyond 2px) |
| Estimated / uncertain | `≈` prefix | — | thin, 50% alpha | dither density | fog / point density |
| Live / stale data | `● LIVE` / `○ STALE 12s` | ● / ○ | — | — | ripple / frozen |

Heatmaps of returns / Sharpe (monthly returns, sweep): `--gain` / `--loss`
tint, opacity = magnitude, **value printed in cell**. Correlation stays a
neutral luminance scale (+ hatch for ρ < 0): it is not a gain/loss.

---

## 7. Textures ("phantom")

- **Grain:** fullscreen film-grain overlay, 3–5% opacity, animated at 12fps
  (static under reduced motion). CSS/canvas, `pointer-events: none`.
- **Dither:** 4×4 / 8×8 Bayer ordered dither as post-processing pass for 3D
  and as SVG `<pattern>` fills for 2D density.
- **Halftone / scanlines / ASCII:** allowed as section transitions and
  loading states (e.g. ASCII density ramp `" .:-=+*#%@"` for skeletons).
- Textures never reduce text contrast below §2 minimums: no grain over
  body text above 3% opacity.

---

## 8. Components

- **Button (primary):** white bg, black text, 0 radius, 40px height
  (44px touch target on mobile), `label` or `title` type, uppercase.
  Hover → invert (black bg, white text, 1px white border), 80ms, no lift.
- **Button (secondary):** transparent, 1px `--rule-strong` border, white
  text. Hover → border white.
- **Input:** `--surface-2` bg, 1px `--rule` bottom border only, mono for
  numeric values, visible `<label>` in `label` style above, helper/error
  text below (error = `!` glyph + text, not color).
- **Focus:** 2px solid `--focus` outline, 2px offset, on every interactive
  element (`:focus-visible`). Never removed.
- **Slider:** 1px track, square 12px thumb, value readout in mono beside it,
  keyboard step and Shift×10.
- **Table:** hairline rows, mono right-aligned numbers, sticky header,
  sortable headers with ▲▼ glyph, zebra via `--surface-2`.
- **Drawer (methodology):** opaque `--surface`, left 1px rule, focus trap,
  Esc closes, KaTeX formulas.
- **Terminal panel (AI explain):** mono, `>` prompt prefix, blinking block
  cursor (static under reduced motion), streaming text, copy button.
- **Status chips:** `[ LIVE ]`, `[ EOD ]`, `[ DELAYED 15M ]`, `[ STALE ]` —
  bracketed mono labels, no pills.
- **Toasts / errors:** top-right, hairline box, glyph + text; rate-limit
  states show countdown.

---

## 9. Data Visualization

- Custom SVG (<1k points) / Canvas 2D (≥1k) with d3-scale/d3-shape;
  >10k points aggregate or rasterize to density.
- Series distinguished by line style (solid/dashed/dotted) + direct labels,
  never by hue. Max 4 series per chart.
- Axes: `label` type, gray-400 text, gray-700 grid, ticks outward 4px.
- Crosshair + mono tooltip; keyboard: arrow keys move focus across points.
- Every chart has an accessible data table / summary toggle (`TABLE ⇄ CHART`).
- Every 3D insight also exists as a 2D chart or table.

---

## 10. Accessibility & Quality Bar

- Text contrast ≥ 4.5:1 (we target ≥ 6:1 — §2 minimum is gray-400).
- Keyboard: full tab order, skip-link, Esc closes overlays, roving focus in
  grids. Canvases: `role="img"` + `aria-label` + adjacent text summary.
- Live regions (`aria-live="polite"`) for streaming results, throttled to ≤1/s.
- Touch targets ≥ 44×44 on mobile. Zoom never disabled.
- No layout shift: reserve stage height, skeletons sized to final.

## 11. Pre-Delivery Checklist (run per page)

- [ ] Zero hue: grep for color literals outside tokens; screenshot luma check
- [ ] Gain/loss readable in grayscale *and* with images off (sign + glyph)
- [ ] Only Lucide SVG icons; no emoji
- [ ] Inter Tight / JetBrains Mono only; tabular-nums on all changing numbers
- [ ] 0px radius, no shadows, no blur, no springs
- [ ] `cursor: pointer` on clickables; hover + `:focus-visible` states
- [ ] `prefers-reduced-motion` → static render verified
- [ ] No-WebGL → 2D fallback verified
- [ ] 375 / 768 / 1024 / 1440 without horizontal scroll
- [ ] Data source + EOD/delayed/live label + timestamp visible
- [ ] "Not investment advice" visible (tool pages)
- [ ] No console errors / hydration warnings; Lighthouse a11y ≥ 95
