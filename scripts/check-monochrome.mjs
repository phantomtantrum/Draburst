#!/usr/bin/env node
// Enforces design-system/quantphantom/MASTER.md §1.1 — no hue outside the tokens.
// Fails if any color literal in src/ (other than src/styles/tokens.css, which
// defines the semantic gain/loss pair) has R≠G≠B (hex, 0x, rgb[a]) or a
// saturated hsl/oklch/lch, or if a chromatic Tailwind palette class appears.
// Components reach color only through var(--gain) / var(--loss).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
const EXT = /\.(tsx?|css|glsl|frag|vert|svg|mjs)$/;

const CHROMATIC = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky',
  'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
  'slate', 'gray', 'zinc', 'stone', // tinted grays in Tailwind's default palette
];
const twClass = new RegExp(
  String.raw`\b(?:bg|text|border|fill|stroke|ring|outline|from|via|to|shadow|accent|caret|decoration|divide|placeholder)-(?:${CHROMATIC.join('|')})-\d{2,3}\b`,
  'g',
);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (EXT.test(name)) out.push(p);
  }
  return out;
}

const isGrayHex = (h) => {
  let r, g, b;
  if (h.length === 3 || h.length === 4) [r, g, b] = [h[0], h[1], h[2]].map((c) => c + c);
  else if (h.length === 6 || h.length === 8) [r, g, b] = [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)];
  else return true; // not a color
  return r.toLowerCase() === g.toLowerCase() && g.toLowerCase() === b.toLowerCase();
};

const problems = [];
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  const isTokens = rel === join('src', 'styles', 'tokens.css');
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const at = `${rel}:${i + 1}`;
    if (/check-monochrome:\s*ignore/.test(line)) return;
    if (isTokens) {
      for (const m of line.matchAll(twClass)) problems.push(`${at}  chromatic Tailwind class ${m[0]}`);
      return;
    }
    // #rgb / #rrggbb / #rrggbbaa  (skip URL fragments & ids like href="#main")
    for (const m of line.matchAll(/(?<![\w&/])#([0-9a-fA-F]{3,8})\b/g)) {
      const h = m[1];
      if (![3, 4, 6, 8].includes(h.length)) continue;
      if (!isGrayHex(h)) problems.push(`${at}  hue in hex #${h}`);
    }
    for (const m of line.matchAll(/\b0x([0-9a-fA-F]{6})\b/g)) {
      if (!isGrayHex(m[1])) problems.push(`${at}  hue in 0x${m[1]}`);
    }
    for (const m of line.matchAll(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/g)) {
      if (!(m[1] === m[2] && m[2] === m[3])) problems.push(`${at}  hue in ${m[0]})`);
    }
    for (const m of line.matchAll(/hsla?\(\s*[\d.]+(?:deg)?[\s,]+([\d.]+)%/g)) {
      if (Number(m[1]) !== 0) problems.push(`${at}  saturated ${m[0]}`);
    }
    for (const m of line.matchAll(/(?:ok)?l(?:ch|ab)\(\s*[\d.%]+\s+([\d.]+)/g)) {
      if (Number(m[1]) !== 0) problems.push(`${at}  chroma in ${m[0]}`);
    }
    for (const m of line.matchAll(twClass)) problems.push(`${at}  chromatic Tailwind class ${m[0]}`);
  });
}

if (problems.length) {
  console.error(`✖ monochrome check failed (${problems.length}):\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log('✔ monochrome check passed');
