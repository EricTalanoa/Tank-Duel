import { PRESENTATION } from '../render/presentation';

export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

export interface OrientationGate {
  dispose(): void;
}

type Viewport = Pick<Window, 'innerWidth' | 'innerHeight' | 'addEventListener' | 'removeEventListener'>;

export function isPresentationBlocked(size: ViewportSize): boolean {
  return PRESENTATION.requiredOrientation === 'landscape' && (
    size.width <= size.height || size.width < PRESENTATION.minimumLandscapeWidthPx
  );
}

export function mountOrientationGate(
  root: HTMLElement,
  viewport: Viewport,
  onBlockedChange: (blocked: boolean) => void,
): OrientationGate {
  const priorInert = root.inert;
  const priorAriaHidden = root.getAttribute('aria-hidden');
  let disposed = false;
  let blocked: boolean | null = null;
  let overlay: HTMLElement | null = null;

  const restoreSurface = (): void => {
    root.inert = priorInert;
    if (priorAriaHidden === null) root.removeAttribute('aria-hidden');
    else root.setAttribute('aria-hidden', priorAriaHidden);
  };

  const apply = (): void => {
    const nextBlocked = isPresentationBlocked({ width: viewport.innerWidth, height: viewport.innerHeight });
    if (blocked === nextBlocked) return;
    blocked = nextBlocked;
    if (nextBlocked) {
      root.inert = true;
      root.setAttribute('aria-hidden', 'true');
      overlay = createOverlay(root.ownerDocument);
      (root.parentElement ?? root).append(overlay);
    } else {
      overlay?.remove();
      overlay = null;
      restoreSurface();
    }
    onBlockedChange(nextBlocked);
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
      overlay?.remove();
      overlay = null;
      restoreSurface();
    },
  };
}

function createOverlay(document: Document): HTMLElement {
  const overlay = document.createElement('section');
  overlay.className = 'orientation-gate';
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'orientation-gate-title');
  overlay.setAttribute('aria-describedby', 'orientation-gate-instruction');

  const icon = document.createElement('span');
  icon.className = 'orientation-gate__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '↻';
  const title = document.createElement('h1');
  title.id = 'orientation-gate-title';
  title.textContent = 'Rotate your iPad';
  const instruction = document.createElement('p');
  instruction.id = 'orientation-gate-instruction';
  instruction.textContent = 'Rotate your device to landscape to continue the duel.';
  overlay.append(icon, title, instruction);
  return overlay;
}
