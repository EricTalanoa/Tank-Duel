import { launchProjectile, stepProjectile } from './ballistics';
import { CONSTANTS } from './constants';
import { HE_SHELL } from './shells';
import { TERRA } from './worlds';

export interface CpuGainMeasurement {
  readonly rangePerPowerPoint: number;
  readonly driftPerWindUnit: number;
}

function flatGroundImpactX(power: number, wind: number): number {
  const projectile = launchProjectile({
    x: 0,
    y: 0,
    angleDeg: (CONSTANTS.elevation.minDisplay + CONSTANTS.elevation.maxDisplay) / 2,
    power,
    direction: 1,
    shell: HE_SHELL,
    owner: 0,
  });
  for (let frame = 0; frame < 10_000; frame++) {
    if (stepProjectile(projectile, {
      world: TERRA,
      wind,
      solidAt: (_x, y) => y >= 0,
    }).hit) return projectile.x;
  }
  throw new Error('Terra HE shot did not land');
}

/**
 * Measures the centered local slopes that the CPU spec describes near the Terra power-75
 * reference range. This intentionally reads live production ballistics rather than CPU rules.
 */
export function deriveTerraCpuGains(): CpuGainMeasurement {
  const lowerPower = 65;
  const referencePower = 75;
  const upperPower = 85;
  const windMagnitude = 100;
  const rangePerPowerPoint = (
    flatGroundImpactX(upperPower, 0) - flatGroundImpactX(lowerPower, 0)
  ) / (upperPower - lowerPower);
  const driftPerWindUnit = (
    flatGroundImpactX(referencePower, windMagnitude)
    - flatGroundImpactX(referencePower, -windMagnitude)
  ) / (windMagnitude * 2);

  return Object.freeze({ rangePerPowerPoint, driftPerWindUnit });
}
