# Page override — `/` (home)

Read `../MASTER.md` first. Rules here override MASTER only where stated.
Hard Constraints (MASTER §1) always apply.

## Purpose
First contact. In 5 seconds a visitor must know what the site does and
where to click: "quant research tools on real market data".

## Section order
1. **Hero** (not full-screen). Left: small "free · live data" chip, plain
   headline (`clamp(38px, 5.2vw, 64px)`), one-paragraph description, primary
   CTA "Start with Monte Carlo →", secondary "See all tools", data-source line.
   Right: **Market now** panel (`--surface`): status chip + UTC clock, the
   live 3D sculpture (220–260px, only when WebGL is hardware-accelerated),
   and always a price table (asset, price, 24h/1d change with gain/loss
   color, 30d vol).
2. **Tools** (`--surface` band): three cards, each with a small seeded SVG
   preview (fan / frontier / equity + drawdown), the question it answers,
   a one-line description, three ✓ points, "Open <tool> →".
3. **How it works**: three numbered steps.
4. **Method** (`--surface` band): copy + link to `/methodology`, three
   formula cards.
5. **Closing CTA** band, then the footer.

## Overrides
- Spacing: marketing scale (64–112px vertical rhythm).
- No scroll-pinned canvas, no full-bleed empty hero, no grain or dither
  textures on backgrounds: sections alternate `--bg` / `--surface`.
