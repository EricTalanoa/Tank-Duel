import raw from '../../spec/generators.json';
import type { Rng } from './rng';

export const SHIPPED_GENERATORS = ['hills', 'canyon', 'craters', 'plates', 'spires', 'ring'] as const;
export type GeneratorId = typeof SHIPPED_GENERATORS[number];
interface MidpointConfig { low: number; high: number; roughness: number }
interface ClampConfig { ceilingFraction: number; floorMargin: number }
interface BaseConfig { id: string; clamp: ClampConfig }
interface MidpointBaseConfig extends BaseConfig { midpoint: MidpointConfig }
interface RingConfig extends BaseConfig {
  harmonicCount: number;
  frequencyStart: number;
  baseHeightFraction: number;
  amplitudeNumeratorFraction: number;
  amplitudeDecayFactor: number;
  phaseRangeRadians: number;
}

function configFor<T extends BaseConfig>(id: GeneratorId): T {
  const config = raw.generators.find((candidate) => candidate.id === id);
  if (!config) throw new Error(`${id} is missing from spec/generators.json`);
  return config as unknown as T;
}

function midpoint(width: number, height: number, rng: Rng, c: MidpointConfig): Float32Array {
  const n = raw.midpoint.points;
  const points = new Float32Array(n + 1);
  points[0] = height * rng.range(c.low, c.high);
  points[n] = height * rng.range(c.low, c.high);
  let step = n;
  let displacement = height * c.roughness;
  while (step > 1) {
    const half = step >> 1;
    for (let i = half; i < n; i += step) {
      points[i] = ((points[i - half] as number) + (points[i + half] as number)) / 2
        + rng.range(-displacement, displacement);
    }
    step = half;
    displacement *= raw.midpoint.displacementDecay;
  }
  const result = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    const t = x * n / width;
    const i = Math.floor(t);
    const f = t - i;
    result[x] = (points[i] as number) * (1 - f) + (points[Math.min(n, i + 1)] as number) * f;
  }
  return result;
}

function clamp(surface: Float32Array, height: number, c: ClampConfig): Float32Array {
  for (let x = 0; x < surface.length; x++) {
    surface[x] = Math.max(height * c.ceilingFraction, Math.min(height - c.floorMargin, surface[x] as number));
  }
  return surface;
}

export function resolveGeneratorId(value: string | null, fallback: GeneratorId): GeneratorId {
  // Ring is the only seamless generator, so a Ring world cannot be overridden by URL input.
  if (fallback === 'ring') return 'ring';
  return SHIPPED_GENERATORS.some((id) => id === value) ? value as GeneratorId : fallback;
}

export function generateHeightmap(width: number, height: number, id: GeneratorId, rng: Rng): Float32Array {
  const base = configFor(id);
  if (id === 'ring') {
    const c = configFor<RingConfig>(id);
    const phases = Array.from(
      { length: c.harmonicCount },
      () => rng.range(0, c.phaseRangeRadians),
    );
    const surface = new Float32Array(width);
    for (let x = 0; x < width; x++) {
      let value = height * c.baseHeightFraction;
      for (let k = 0; k < c.harmonicCount; k++) {
        const frequency = c.frequencyStart + k;
        const amplitude = height * c.amplitudeNumeratorFraction / (k * c.amplitudeDecayFactor + 1);
        value += Math.sin((x / width) * c.phaseRangeRadians * frequency + (phases[k] as number)) * amplitude;
      }
      surface[x] = value;
    }
    return clamp(surface, height, c.clamp);
  }

  const surface = midpoint(width, height, rng, configFor<MidpointBaseConfig>(id).midpoint);
  if (id === 'hills') {
    const c = configFor<BaseConfig & { sines: { frequency: number; amplitude: number; phase: number }[] }>(id);
    for (let x = 0; x < width; x++) for (const sine of c.sines) {
      surface[x] = (surface[x] as number) + Math.sin(x * sine.frequency + sine.phase) * sine.amplitude;
    }
  } else if (id === 'canyon') {
    const c = configFor<BaseConfig & { gaussianDivisor: number; targetHeightFraction: number }>(id);
    for (let x = 0; x < width; x++) {
      const t = (x / width - 0.5) * 2;
      const g = Math.exp(-(t * t) / c.gaussianDivisor);
      surface[x] = (surface[x] as number) + g * (height * c.targetHeightFraction - (surface[x] as number));
    }
  } else if (id === 'craters') {
    const c = configFor<BaseConfig & { count: { base: number; spread: number }; radius: { baseFraction: number; spreadFraction: number }; depth: { base: number; spread: number; bowlScale: number }; rim: { start: number; end: number; scale: number } }>(id);
    const count = c.count.base + rng.int(c.count.spread);
    for (let k = 0; k < count; k++) {
      const cx = rng.next() * width;
      const radius = width * (c.radius.baseFraction + rng.next() * c.radius.spreadFraction);
      const depth = radius * (c.depth.base + rng.next() * c.depth.spread);
      for (let x = Math.max(0, (cx - radius) | 0); x < Math.min(width, (cx + radius) | 0); x++) {
        const dx = (x - cx) / radius;
        surface[x] = (surface[x] as number) + depth * Math.max(0, 1 - dx * dx) * c.depth.bowlScale;
        if (Math.abs(dx) > c.rim.start && Math.abs(dx) < c.rim.end) surface[x] = (surface[x] as number) - depth * c.rim.scale;
      }
    }
  } else if (id === 'plates') {
    const c = configFor<BaseConfig & { stepFraction: number }>(id);
    const step = height * c.stepFraction;
    for (let x = 0; x < width; x++) surface[x] = Math.round((surface[x] as number) / step) * step;
  } else {
    const c = configFor<BaseConfig & { count: { base: number; spread: number }; centre: { baseFraction: number; spreadFraction: number }; width: { baseFraction: number; spreadFraction: number; extent: number }; height: { baseFraction: number; spreadFraction: number; referenceWidthPx: number }; gaussianScale: number }>(id);
    const count = c.count.base + rng.int(c.count.spread);
    for (let k = 0; k < count; k++) {
      const cx = width * (c.centre.baseFraction + rng.next() * c.centre.spreadFraction);
      const radius = width * (c.width.baseFraction + rng.next() * c.width.spreadFraction);
      const widthScale = Math.min(1, width / c.height.referenceWidthPx);
      const peak = height * (c.height.baseFraction + rng.next() * c.height.spreadFraction) * widthScale;
      for (let x = Math.max(0, (cx - radius * c.width.extent) | 0); x < Math.min(width, (cx + radius * c.width.extent) | 0); x++) {
        const dx = (x - cx) / radius;
        surface[x] = (surface[x] as number) - peak * Math.exp(-dx * dx * c.gaussianScale);
      }
    }
  }
  return clamp(surface, height, base.clamp);
}

export function hillsHeightmap(width: number, height: number, rng: Rng): Float32Array {
  return generateHeightmap(width, height, 'hills', rng);
}
