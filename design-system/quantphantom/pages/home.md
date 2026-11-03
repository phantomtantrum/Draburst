# Page override — `/` (home)

Read `../MASTER.md` first. Rules here override MASTER only where stated.
Hard Constraints (MASTER §1) always apply.

## Purpose
First contact. In 5 seconds a visitor must know what the site does and
where to click: "quant research tools on real market data".

## Section order
1. **First screen** (100svh, true black). Background: `QuantumField`, a
   live double-slit picture: |ψ|² of interfering wave sources as soft
   ripples + a point lattice + fading particle "measurements"; the pointer
   adds a source. Corner readouts: `00 / QUANTUM FIELD · |ψ|²`, status
   chip, UTC clock, sources. Bottom: the giant `quantphantom` wordmark
   (`.wordmark`, as in the first versions), one-line description, CTAs.
   The field fades out behind the text.
2. **Live market**: copy left; "Market now" panel right (3D sculpture on
   hardware GPUs, always a price table with gain/loss color).
3. **Tools** (`--surface` band): three cards with seeded SVG previews.
4. **How it works**: three numbered steps.
5. **Method** (`--surface` band): copy + three formula cards.
6. **Closing CTA**, then the footer.

## Overrides
- Spacing: marketing scale (64–112px vertical rhythm).
- No scroll-pinned canvas, no grain or dither textures on backgrounds;
  sections alternate `--bg` / `--surface`.
- QuantumField: Canvas 2D (no WebGL), ≤30 fps, paused offscreen and in
  hidden tabs, one still frame under reduced motion.
