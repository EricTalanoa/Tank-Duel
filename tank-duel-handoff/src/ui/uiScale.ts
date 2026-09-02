import { PRESENTATION } from '../render/presentation';

export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

export interface UiScale {
  dispose(): void;
}

type Viewport = Pick<Window, 'innerWidth' | 'innerHeight' | 'addEventListener' | 'removeEventListener'>;

/**
 * The menus are drawn once, at the iPad size in `spec/presentation.json`, and every other
 * landscape viewport gets that same layout scaled to fit. Nothing reflows: a phone shows the
 * iPad screen small, a desktop shows it large, and neither needs its own set of rules.
 *
 * The scale is the smaller of the two fits, so an unclamped scale guarantees the design's
 * full width *and* height are available. `spec/presentation.json -> uiScaleBounds` clamps it
 * at both ends — the floor is legibility rather than fit, so a viewport shorter than
 * `designSize.height / min` overflows and `.screen-body` scrolls.
 */
export const UI_SCALE_PROPERTY = '--ui-scale';

export function uiScaleFor(size: ViewportSize): number {
  const { designSize, uiScaleBounds } = PRESENTATION;
  const width = Math.max(1, size.width);
  const height = Math.max(1, size.height);
  const fit = Math.min(width / designSize.width, height / designSize.height);
  return clamp(round(fit), uiScaleBounds.min, uiScaleBounds.max);
}

/**
 * Applied as a custom property rather than a transform here so the stylesheets own how each
 * surface uses it — the menu root scales, the touch controls deliberately do not, because a
 * 44px hit target that shrinks with the design stops being a 44px hit target.
 */
export function mountUiScale(root: HTMLElement, viewport: Viewport): UiScale {
  let disposed = false;
  let applied: number | null = null;

  const apply = (): void => {
    const scale = uiScaleFor({ width: viewport.innerWidth, height: viewport.innerHeight });
    if (applied === scale) return;
    applied = scale;
    root.style?.setProperty(UI_SCALE_PROPERTY, String(scale));
  };

  const onViewportChange = (): void => {
    if (!disposed) apply();
  };

  viewport.addEventListener('resize', onViewportChange);
  viewport.addEventListener('orientationchange', onViewportChange);
  apply();

  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      viewport.removeEventListener('resize', onViewportChange);
      viewport.removeEventListener('orientationchange', onViewportChange);
      root.style?.removeProperty(UI_SCALE_PROPERTY);
    },
  };
}

/**
 * Two decimals. A scale carried at full precision changes on every pixel of a drag-resize,
 * and each change relays every screen; rounding makes the property stable enough to skip.
 */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
