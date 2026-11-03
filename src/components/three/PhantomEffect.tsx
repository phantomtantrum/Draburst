'use client';

import { forwardRef, useEffect, useMemo } from 'react';
import { BlendFunction, Effect } from 'postprocessing';
import { Uniform, type WebGLRenderer, type WebGLRenderTarget } from 'three';

/**
 * The brand's final pass (MASTER §7): luma-only (zero hue by construction),
 * film grain, then 8×8 ordered (Bayer) dither quantized to `levels` grays.
 * Data "emerges from noise".
 */
const fragment = /* glsl */ `
uniform float uTime;
uniform float uGrain;
uniform float uLevels;
uniform float uDither;
uniform float uBg;

float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
#define bayer4(a) (bayer2(0.5 * (a)) * 0.25 + bayer2(a))
#define bayer8(a) (bayer4(0.5 * (a)) * 0.25 + bayer2(a))

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // work on the signal above the background so the empty canvas stays a flat,
  // noise-free --bg instead of a speckled dither field
  float l = dot(inputColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  float s = clamp((l - uBg) / (1.0 - uBg), 0.0, 1.0);
  vec2 px = gl_FragCoord.xy;
  float g = hash(px + floor(uTime * 12.0) * vec2(17.0, 31.0)) - 0.5;
  float presence = smoothstep(0.0, 0.04, s);
  s = clamp(s + g * uGrain * presence, 0.0, 1.0);
  float d = (bayer8(px) - 0.5) * presence;
  float q = clamp(floor(s * uLevels + 0.5 + d * uDither) / uLevels, 0.0, 1.0);
  outputColor = vec4(vec3(uBg + q * (1.0 - uBg)), inputColor.a);
}
`;

export interface PhantomOptions {
  grain?: number;
  levels?: number;
  dither?: number;
  animate?: boolean;
  /** background luma (0–1, linear) kept flat; defaults to the --bg token #000000 */
  bg?: number;
}

/** The effect runs on linear color, so the sRGB --bg is converted once. */
const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const BG_LINEAR = srgbToLinear(0x00 / 255);

class PhantomEffectImpl extends Effect {
  animate: boolean;
  constructor({ grain = 0.08, levels = 7, dither = 1, animate = true, bg = BG_LINEAR }: PhantomOptions = {}) {
    super('PhantomEffect', fragment, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform<number>>([
        ['uTime', new Uniform(0)],
        ['uGrain', new Uniform(grain)],
        ['uLevels', new Uniform(levels)],
        ['uDither', new Uniform(dither)],
        ['uBg', new Uniform(bg)],
      ]),
    });
    this.animate = animate;
  }
  override update(_r: WebGLRenderer, _i: WebGLRenderTarget, dt?: number) {
    if (this.animate) (this.uniforms.get('uTime') as Uniform<number>).value += dt ?? 0.016;
  }
}

export const PhantomEffect = forwardRef<PhantomEffectImpl, PhantomOptions>(function PhantomEffect({ grain, levels, dither, animate, bg }, ref) {
  const effect = useMemo(() => new PhantomEffectImpl({ grain, levels, dither, animate, bg }), [grain, levels, dither, animate, bg]);
  useEffect(() => () => effect.dispose(), [effect]);
  return <primitive ref={ref} object={effect} dispose={null} />;
});
