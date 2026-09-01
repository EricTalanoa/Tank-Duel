export interface TouchAimPoint {
  readonly x: number;
  readonly y: number;
}

export interface TouchAimResult {
  readonly angleDeg: number;
  readonly power: number;
}

export function mapTouchAim(
  origin: TouchAimPoint,
  pointer: TouchAimPoint,
  direction: 1 | -1,
  powerRange: Readonly<{ min: number; max: number }>,
  maxDragPx: number,
): TouchAimResult {
  const dx = pointer.x - origin.x;
  const dy = pointer.y - origin.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return { angleDeg: 0, power: powerRange.min };

  const downrange = Math.max(0, dx * direction);
  const rise = Math.max(0, -dy);
  const angleDeg = Math.min(90, Math.max(0, Math.atan2(rise, downrange) * 180 / Math.PI));
  const powerFraction = Math.min(1, distance / Math.max(1, maxDragPx));
  const power = powerRange.min + (powerRange.max - powerRange.min) * powerFraction;
  return { angleDeg, power };
}
