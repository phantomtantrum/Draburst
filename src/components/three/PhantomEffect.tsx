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

float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
#define bayer4(a) (bayer2(0.5 * (a)) * 0.25 + bayer2(a))
#define bayer8(a) (bayer4(0.5 * (a)) * 0.25 + bayer2(a))

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float l = dot(inputColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec2 px = gl_FragCoord.xy;
  float g = hash(px + floor(uTime * 12.0) * vec2(17.0, 31.0)) - 0.5;
  l = clamp(l + g * uGrain, 0.0, 1.0);
  float d = bayer8(px) - 0.5;
  float q = floor(l * uLevels + 0.5 + d * uDither) / uLevels;
  outputColor = vec4(vec3(clamp(q, 0.0, 1.0)), inputColor.a);
}
`;

export interface PhantomOptions {
  grain?: number;
  levels?: number;
  dither?: number;
  animate?: boolean;
}

class PhantomEffectImpl extends Effect {
  animate: boolean;
  constructor({ grain = 0.08, levels = 7, dither = 1, animate = true }: PhantomOptions = {}) {
    super('PhantomEffect', fragment, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform<number>>([
        ['uTime', new Uniform(0)],
        ['uGrain', new Uniform(grain)],
        ['uLevels', new Uniform(levels)],
        ['uDither', new Uniform(dither)],
      ]),
    });
    this.animate = animate;
  }
  override update(_r: WebGLRenderer, _i: WebGLRenderTarget, dt?: number) {
    if (this.animate) (this.uniforms.get('uTime') as Uniform<number>).value += dt ?? 0.016;
  }
}

export const PhantomEffect = forwardRef<PhantomEffectImpl, PhantomOptions>(function PhantomEffect({ grain, levels, dither, animate }, ref) {
  const effect = useMemo(() => new PhantomEffectImpl({ grain, levels, dither, animate }), [grain, levels, dither, animate]);
  useEffect(() => () => effect.dispose(), [effect]);
  return <primitive ref={ref} object={effect} dispose={null} />;
});
