import { CONSTANTS } from '../sim/constants';
import type { GameState } from '../sim/world';
import { nearestWrappedX } from '../sim/wrap';

export interface CameraView {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ViewportSize { readonly width: number; readonly height: number }

export function clampCamera(view: CameraView, field: GameState['field']): CameraView {
  const width = Math.min(field.width, view.width);
  const height = Math.min(field.height, view.height);
  return {
    x: Math.max(0, Math.min(field.width - width, view.x)),
    y: Math.max(0, Math.min(field.height - height, view.y)),
    width,
    height,
  };
}

function clampCameraVertically(view: CameraView, field: GameState['field']): CameraView {
  const height = Math.min(field.height, view.height);
  return {
    ...view,
    y: Math.max(0, Math.min(field.height - height, view.y)),
    height,
  };
}

export function cameraForState(state: GameState, _viewport: ViewportSize): CameraView {
  const { field } = state;
  if (state.phase === 'flight' && state.projectile) {
    const width = Math.min(field.width, CONSTANTS.defaultFieldWidth);
    const flightView = {
      x: state.projectile.x - width / 2,
      y: 0,
      width,
      height: field.height,
    };
    return state.world.wrap
      ? clampCameraVertically(flightView, field)
      : clampCamera(flightView, field);
  }

  if (state.world.wrap) {
    const active = state.tanks[state.activePlayer];
    const opponent = state.tanks[state.activePlayer === 0 ? 1 : 0];
    const opponentX = nearestWrappedX(opponent.x, active.x, field.width);
    const left = Math.min(active.x, opponentX) - CONSTANTS.camera.aimPaddingPx;
    const right = Math.max(active.x, opponentX) + CONSTANTS.camera.aimPaddingPx;
    return clampCameraVertically({
      x: left,
      y: 0,
      width: right - left,
      height: field.height,
    }, field);
  }

  const left = Math.min(state.tanks[0].x, state.tanks[1].x) - CONSTANTS.camera.aimPaddingPx;
  const right = Math.max(state.tanks[0].x, state.tanks[1].x) + CONSTANTS.camera.aimPaddingPx;
  return clampCamera({ x: left, y: 0, width: right - left, height: field.height }, field);
}
