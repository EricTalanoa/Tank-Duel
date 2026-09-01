import type { Phase } from '../sim/world';

export interface FlightStepScaler {
  carry: number;
}

export function createFlightStepScaler(): FlightStepScaler {
  return { carry: 0 };
}

export function simulationStepsForFrame(
  scaler: FlightStepScaler,
  requestedSteps: number,
  paused: boolean,
  phase: Phase,
  flightTimeScale: number,
): number {
  if (paused) return 0;
  if (phase !== 'flight') {
    scaler.carry = 0;
    return requestedSteps;
  }
  const scaled = requestedSteps * flightTimeScale + scaler.carry;
  const steps = Math.floor(scaled + Number.EPSILON);
  scaler.carry = scaled - steps;
  return steps;
}
