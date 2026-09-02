import { PRESENTATION } from '../render/presentation';

export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

export interface OrientationGate {
  /**
   * Re-evaluate now. The viewport has not changed — what the app is doing with it has, and
   * only the caller knows that.
   */
  refresh(): void;
  dispose(): void;
}

export interface OrientationGateOptions {
  readonly onBlockedChange: (blocked: boolean) => void;
  /**
   * Whether what is on screen needs the full iPad width. The match HUD does — it is drawn at
   * fixed viewport anchors from `spec/presentation.json`'s design size — so it is gated. The
   * menus reflow, so they are not: a phone in landscape can set a match up and has to move to
   * a wider screen only to fight it.
   */
  readonly needsFullWidth?: () => boolean;
  /**
   * A way out of a wall the player cannot clear by moving the device. Rotating fixes
   * `portrait`; nothing they can do on a phone fixes `compact`, so without this the match
   * gate strands them behind an overlay with only a page reload to escape it.
   */
  readonly onLeave?: () => void;
}

type Viewport = Pick<Window, 'innerWidth' | 'innerHeight' | 'addEventListener' | 'removeEventListener'>;

/**
 * How well the viewport fits the presentation.
 *
 * `portrait` is fatal whatever is on screen — the whole game is landscape. `compact` is
 * landscape but under the iPad width floor, which the menus survive and the match does not.
 */
export type PresentationFit = 'ok' | 'portrait' | 'compact';

export function presentationFit(size: ViewportSize): PresentationFit {
  if (PRESENTATION.requiredOrientation === 'landscape' && size.width <= size.height) return 'portrait';
  return size.width < PRESENTATION.minimumLandscapeWidthPx ? 'compact' : 'ok';
}

/** True when nothing can be shown at this size, whatever the app is doing. */
export function isPresentationBlocked(size: ViewportSize): boolean {
  return presentationFit(size) === 'portrait';
}

export function mountOrientationGate(
  root: HTMLElement,
  viewport: Viewport,
  options: OrientationGateOptions,
): OrientationGate {
  const priorInert = root.inert;
  const priorAriaHidden = root.getAttribute('aria-hidden');
  const needsFullWidth = options.needsFullWidth ?? ((): boolean => true);
  const onLeave = options.onLeave;
  let disposed = false;
  // `applied` is separate from `blockedBy` because `null` means "not blocked", which is also
  // where the gate starts: without it the first evaluation would report no change and the
  // caller would never hear the opening state.
  let applied = false;
  let blockedBy: PresentationFit | null = null;
  let overlay: HTMLElement | null = null;

  const restoreSurface = (): void => {
    root.inert = priorInert;
    if (priorAriaHidden === null) root.removeAttribute('aria-hidden');
    else root.setAttribute('aria-hidden', priorAriaHidden);
  };

  const apply = (): void => {
    const fit = presentationFit({ width: viewport.innerWidth, height: viewport.innerHeight });
    const nextBlockedBy = fit === 'portrait' || (fit === 'compact' && needsFullWidth()) ? fit : null;
    if (applied && blockedBy === nextBlockedBy) return;
    const announce = !applied || (blockedBy !== null) !== (nextBlockedBy !== null);
    applied = true;
    blockedBy = nextBlockedBy;

    overlay?.remove();
    overlay = null;
    if (nextBlockedBy) {
      root.inert = true;
      root.setAttribute('aria-hidden', 'true');
      overlay = createOverlay(root.ownerDocument, nextBlockedBy, onLeave);
      (root.parentElement ?? root).append(overlay);
    } else {
      restoreSurface();
    }
    // One notification per blocked-state change: swapping which wall is up is not a change
    // of state to anything downstream, which only cares that the game is paused.
    if (announce) options.onBlockedChange(nextBlockedBy !== null);
  };

  const onViewportChange = (): void => {
    if (!disposed) apply();
  };

  viewport.addEventListener('resize', onViewportChange);
  viewport.addEventListener('orientationchange', onViewportChange);
  apply();

  return {
    refresh(): void {
      if (!disposed) apply();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      viewport.removeEventListener('resize', onViewportChange);
      viewport.removeEventListener('orientationchange', onViewportChange);
      overlay?.remove();
      overlay = null;
      restoreSurface();
    },
  };
}

/**
 * Say which wall this is. The old copy asked for a rotation whatever the reason, so a player
 * who had already turned their phone sideways was told to turn it sideways again.
 */
const GATE_COPY: Readonly<Record<Exclude<PresentationFit, 'ok'>, {
  readonly icon: string;
  readonly title: string;
  readonly instruction: string;
}>> = Object.freeze({
  portrait: Object.freeze({
    icon: '↻',
    title: 'Rotate your device',
    instruction: 'Tank Duel is played in landscape. Turn your device sideways to continue.',
  }),
  compact: Object.freeze({
    icon: '⤢',
    title: 'Screen too narrow',
    instruction: `The duel is drawn for a landscape iPad, at least ${PRESENTATION.minimumLandscapeWidthPx}px wide. Set the match up here, then open it on a bigger screen to fight it.`,
  }),
});

function createOverlay(
  document: Document,
  fit: Exclude<PresentationFit, 'ok'>,
  onLeave: (() => void) | undefined,
): HTMLElement {
  const copy = GATE_COPY[fit];
  const overlay = document.createElement('section');
  overlay.className = 'orientation-gate';
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'orientation-gate-title');
  overlay.setAttribute('aria-describedby', 'orientation-gate-instruction');
  overlay.setAttribute('data-gate', fit);

  const icon = document.createElement('span');
  icon.className = 'orientation-gate__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = copy.icon;
  const title = document.createElement('h1');
  title.id = 'orientation-gate-title';
  title.textContent = copy.title;
  const instruction = document.createElement('p');
  instruction.id = 'orientation-gate-instruction';
  instruction.textContent = copy.instruction;
  overlay.append(icon, title, instruction);

  // Only where the player cannot clear the wall themselves. Offering "back to the menu" to
  // someone who just has to turn their phone would be noise.
  if (fit === 'compact' && onLeave) {
    const leave = document.createElement('button');
    leave.className = 'orientation-gate__leave';
    leave.setAttribute('type', 'button');
    leave.textContent = 'Back to the menu';
    leave.addEventListener('click', () => onLeave());
    overlay.append(leave);
  }
  return overlay;
}
