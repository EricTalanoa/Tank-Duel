export interface MatchChromeCallbacks {
  /** Restart the round on the same battlefield, from turn one. */
  readonly onReset: () => void;
  /** Abandon the match and return to the title screen. */
  readonly onExit: () => void;
}

export interface MountedMatchChrome {
  dispose(): void;
}

/**
 * The two match-level controls, flanking the canvas turn line at the top of the screen.
 *
 * They sit in the DOM rather than being drawn into the HUD for the reason the touch
 * controls do: a canvas rectangle is not a button. These are focusable, labelled, and 44px
 * whatever the viewport, which a hit-tested rectangle would have to reimplement.
 *
 * The bar is a `1fr auto 1fr` grid whose middle column is an empty spacer the width of the
 * turn line. That is what keeps the two buttons pinned either side of text this module
 * never sees — the canvas centres the line on the viewport, and so does the spacer.
 */
export function mountMatchChrome(
  root: HTMLElement,
  callbacks: MatchChromeCallbacks,
): MountedMatchChrome {
  const document = root.ownerDocument;
  let disposed = false;
  let confirming: HTMLElement | null = null;

  const bar = document.createElement('section');
  bar.className = 'match-topbar';
  bar.setAttribute('aria-label', 'Match controls');

  const reset = chromeButton(document, '↺', 'Reset', 'Restart this round');
  const spacer = document.createElement('span');
  spacer.className = 'match-topbar-spacer';
  spacer.setAttribute('aria-hidden', 'true');
  const menu = chromeButton(document, '☰', 'Menu', 'Leave the match');

  bar.append(reset, spacer, menu);
  root.append(bar);

  /**
   * Reset restarts a round the player is losing; Menu throws the whole match away, which is
   * the one that gets confirmed. The scrim covers the firing controls too, so a stray tap
   * behind the dialog cannot fire a shell while the question is on screen.
   */
  const closeConfirm = (): void => {
    confirming?.remove();
    confirming = null;
    if (!disposed) menu.focus?.();
  };

  const openConfirm = (): void => {
    if (confirming) return;
    const dialog = document.createElement('section');
    dialog.className = 'match-confirm';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'match-confirm-title');

    const panel = document.createElement('div');
    panel.className = 'match-confirm-panel';
    const title = document.createElement('h2');
    title.id = 'match-confirm-title';
    title.textContent = 'Leave the match?';
    const body = document.createElement('p');
    body.textContent = 'This round ends now and the score is lost.';

    const actions = document.createElement('div');
    actions.className = 'match-confirm-actions';
    const cancel = textButton(document, 'Keep playing', 'match-confirm-button');
    const leave = textButton(document, 'Leave', 'match-confirm-button is-danger');
    cancel.addEventListener('click', closeConfirm);
    leave.addEventListener('click', () => {
      closeConfirm();
      if (!disposed) callbacks.onExit();
    });
    actions.append(cancel, leave);

    panel.append(title, body, actions);
    dialog.append(panel);
    root.append(dialog);
    confirming = dialog;
    cancel.focus?.();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!disposed && confirming && event.key === 'Escape') closeConfirm();
  };

  reset.addEventListener('click', () => {
    if (!disposed && !confirming) callbacks.onReset();
  });
  menu.addEventListener('click', openConfirm);
  document.addEventListener('keydown', onKeyDown);

  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      document.removeEventListener('keydown', onKeyDown);
      confirming?.remove();
      confirming = null;
      bar.remove();
    },
  };
}

/**
 * Glyph and label in one button. The label is hidden by the stylesheet on a viewport short
 * enough that the nameplates crowd the centre, which is why the glyph is not `aria-hidden`
 * decoration around the only text — the accessible name comes from `aria-label` and holds
 * either way.
 */
function chromeButton(
  document: Document,
  glyph: string,
  label: string,
  description: string,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'match-topbar-button';
  button.setAttribute('aria-label', description);
  button.setAttribute('data-match-control', label.toLowerCase());

  const mark = document.createElement('span');
  mark.className = 'match-topbar-glyph';
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = glyph;
  const text = document.createElement('span');
  text.className = 'match-topbar-label';
  text.textContent = label;

  button.append(mark, text);
  return button;
}

function textButton(document: Document, label: string, className: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  return button;
}
