'use client';

import { useEffect, useRef } from 'react';

/**
 * "Quantum" hero background — a live double-slit picture:
 *  1. the probability density |ψ|² of a few interfering wave sources, drawn
 *     as soft glowing ripples (low-res field, smoothly upscaled);
 *  2. a lattice of points lit by the same density;
 *  3. "measurements": particles that appear where |ψ|² is high and fade,
 *     slowly building up the interference fringes.
 * The pointer adds its own source. Canvas 2D (no WebGL), ≤30 fps, paused
 * offscreen / in hidden tabs, one still frame under reduced motion.
 */
export function QuantumField({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const SCALE = 6; // field resolution: one sample per 6 CSS px
    const field = document.createElement('canvas');
    const fctx = field.getContext('2d');
    if (!fctx) return;
    let img: ImageData | null = null;

    let w = 0;
    let h = 0;
    let gap = 24;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width;
      h = r.height;
      gap = w < 640 ? 20 : 24;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      field.width = Math.max(1, Math.ceil(w / SCALE));
      field.height = Math.max(1, Math.ceil(h / SCALE));
      img = fctx.createImageData(field.width, field.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const k = (2 * Math.PI) / 110; // wavelength ≈ 110px
    const omega = 1.3;
    const pointer = { x: 0, y: 0, a: 0 };
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.a = 1;
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    type Src = { x: number; y: number; a: number; p: number };
    let sources: Src[] = [];
    let norm = 1;
    const setSources = (t: number) => {
      // two close "slits" on the right + a weaker distant source
      const sx = w * (0.74 + 0.05 * Math.sin(t * 0.08));
      const sy = h * (0.36 + 0.08 * Math.cos(t * 0.1));
      const d = Math.min(w, h) * 0.11;
      sources = [
        { x: sx, y: sy - d, a: 1, p: 0 },
        { x: sx, y: sy + d, a: 1, p: 0 },
        { x: w * (0.2 + 0.08 * Math.sin(t * 0.06 + 1)), y: h * (0.15 + 0.06 * Math.sin(t * 0.09)), a: 0.55, p: Math.PI / 2 },
      ];
      if (pointer.a > 0.02) sources.push({ x: pointer.x, y: pointer.y, a: 0.8 * pointer.a, p: 0 });
      norm = 0;
      for (const s of sources) norm += s.a;
      norm *= norm;
    };
    const density = (x: number, y: number, t: number) => {
      let re = 0;
      let im = 0;
      for (const s of sources) {
        const dx = x - s.x;
        const dy = y - s.y;
        const r = Math.sqrt(dx * dx + dy * dy);
        const amp = s.a / Math.sqrt(1 + r / 260);
        const ph = k * r - omega * t + s.p;
        re += amp * Math.cos(ph);
        im += amp * Math.sin(ph);
      }
      return (re * re + im * im) / norm; // 0…1
    };
    // keep the lower-left (wordmark + copy) calm
    const fadeAt = (x: number, y: number) => {
      const fy = Math.min(1, Math.max(0.12, 1.3 - y / h));
      const fx = Math.min(1, 0.45 + x / w);
      return fy * fx;
    };

    const hits: Array<{ x: number; y: number; born: number }> = [];

    const draw = (t: number) => {
      setSources(t);
      ctx.clearRect(0, 0, w, h);

      // 1 — soft field
      if (img) {
        const fw = field.width;
        const fh = field.height;
        const data = img.data;
        for (let j = 0; j < fh; j++) {
          const y = j * SCALE;
          for (let i = 0; i < fw; i++) {
            const x = i * SCALE;
            const p = density(x, y, t);
            const v = Math.min(255, 255 * 0.34 * Math.pow(p, 1.4) * fadeAt(x, y));
            const o = (j * fw + i) * 4;
            data[o] = data[o + 1] = data[o + 2] = v;
            data[o + 3] = 255;
          }
        }
        fctx.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(field, 0, 0, fw * SCALE, fh * SCALE);
      }

      // 2 — lattice
      ctx.fillStyle = '#ffffff';
      const cols = Math.ceil(w / gap) + 1;
      const rows = Math.ceil(h / gap) + 1;
      const ox = (w - (cols - 1) * gap) / 2;
      const oy = (h - (rows - 1) * gap) / 2;
      for (let j = 0; j < rows; j++) {
        const y = oy + j * gap;
        for (let i = 0; i < cols; i++) {
          const x = ox + i * gap;
          const p = density(x, y, t);
          const a = (0.08 + 0.6 * p) * fadeAt(x, y);
          if (a < 0.04) continue;
          const s = 1 + 1.4 * p;
          ctx.globalAlpha = a;
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
        }
      }

      // 3 — measurements (rejection-sampled from |ψ|²)
      if (!reduce) {
        for (let n = 0; n < 24 && hits.length < 220; n++) {
          const x = Math.random() * w;
          const y = Math.random() * h;
          if (Math.random() < Math.pow(density(x, y, t), 2) * fadeAt(x, y) * 0.6) hits.push({ x, y, born: t });
        }
      }
      for (let i = hits.length - 1; i >= 0; i--) {
        const hit = hits[i]!;
        const age = t - hit.born;
        if (age > 2.4) {
          hits.splice(i, 1);
          continue;
        }
        const a = Math.max(0, 1 - age / 2.4);
        ctx.globalAlpha = 0.85 * a;
        ctx.beginPath();
        ctx.arc(hit.x, hit.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
        if (age < 0.5) {
          ctx.globalAlpha = 0.35 * (1 - age / 0.5);
          ctx.beginPath();
          ctx.arc(hit.x, hit.y, 2 + age * 18, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 0.75;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    };

    let raf = 0;
    let last = 0;
    let visible = true;
    const start = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden || now - last < 33) return;
      last = now;
      pointer.a *= 0.97;
      draw((now - start) / 1000);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting;
    });
    io.observe(canvas);
    if (reduce) draw(4);
    else raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={className} />;
}
