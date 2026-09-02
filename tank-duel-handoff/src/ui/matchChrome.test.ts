import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { mountMatchChrome } from './matchChrome';

describe('match chrome', () => {
  it('puts Reset and Menu either side of a spacer the width of the turn line', () => {
    const root = createRoot();
    mountMatchChrome(root as unknown as HTMLElement, { onReset: vi.fn(), onExit: vi.fn() });

    const bar = root.children[0]!;
    expect(bar.className).toBe('match-topbar');
    expect(bar.getAttribute('aria-label')).toBe('Match controls');
    // Button, spacer, button — the empty middle column is what pins the two either side of
    // the turn line the canvas centres on the viewport.
    expect(bar.children.map((child) => child.className)).toEqual([
      'match-topbar-button',
      'match-topbar-spacer',
      'match-topbar-button',
    ]);
    expect(bar.children.map((child) => child.getAttribute('data-match-control')))
      .toEqual(['reset', null, 'menu']);
    // The glyph is decoration; the accessible name says what the button does.
    expect(bar.children.map((child) => child.getAttribute('aria-label')))
      .toEqual(['Restart this round', null, 'Leave the match']);
    expect(bar.children.every((child) => child.tagName !== 'BUTTON' || child.type === 'button'))
      .toBe(true);
  });

  it('resets without a confirmation and leaves only through one', () => {
    const root = createRoot();
    const onReset = vi.fn();
    const onExit = vi.fn();
    mountMatchChrome(root as unknown as HTMLElement, { onReset, onExit });

    // Reset costs a round, not a match, so it acts immediately.
    root.first('[data-match-control="reset"]')!.click();
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(root.all('.match-confirm')).toHaveLength(0);

    // Menu throws the whole match away, so it asks first and calls nothing yet.
    root.first('[data-match-control="menu"]')!.click();
    expect(onExit).not.toHaveBeenCalled();
    const dialog = root.first('.match-confirm')!;
    expect(dialog.getAttribute('role')).toBe('alertdialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.textContent).toContain('Leave the match?');

    root.all('.match-confirm-button')[1]!.click();
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(root.all('.match-confirm')).toHaveLength(0);
  });

  it('backs out of the confirmation by button and by Escape, without leaving', () => {
    const root = createRoot();
    const onReset = vi.fn();
    const onExit = vi.fn();
    mountMatchChrome(root as unknown as HTMLElement, { onReset, onExit });

    root.first('[data-match-control="menu"]')!.click();
    root.all('.match-confirm-button')[0]!.click();
    expect(onExit).not.toHaveBeenCalled();
    expect(root.all('.match-confirm')).toHaveLength(0);

    root.first('[data-match-control="menu"]')!.click();
    // A second press must not stack a second dialog on the first.
    root.first('[data-match-control="menu"]')!.click();
    expect(root.all('.match-confirm')).toHaveLength(1);

    // Reset is inert behind the question: the player is answering it, not playing.
    root.first('[data-match-control="reset"]')!.click();
    expect(onReset).not.toHaveBeenCalled();

    root.ownerDocument.press('Escape');
    expect(root.all('.match-confirm')).toHaveLength(0);
    expect(onExit).not.toHaveBeenCalled();
  });

  it('disposes idempotently, removing an open dialog and the document listener', () => {
    const root = createRoot();
    const onReset = vi.fn();
    const onExit = vi.fn();
    const chrome = mountMatchChrome(root as unknown as HTMLElement, { onReset, onExit });

    root.first('[data-match-control="menu"]')!.click();
    const leave = root.all('.match-confirm-button')[1]!;
    const reset = root.first('[data-match-control="reset"]')!;

    chrome.dispose();
    chrome.dispose();

    expect(root.children).toHaveLength(0);
    expect(root.ownerDocument.listenerCount).toBe(0);
    // Handles held from before disposal are inert rather than live.
    leave.click();
    reset.click();
    expect(onExit).not.toHaveBeenCalled();
    expect(onReset).not.toHaveBeenCalled();
  });

  it('keeps the buttons a 44px target and hides only the label when space is short', () => {
    const stylesheet = readFileSync(fileURLToPath(new URL('./matchChrome.css', import.meta.url)), 'utf8');

    expect(stylesheet).toMatch(/\.match-topbar-button[^{]*\{[^}]*min-block-size:\s*44px/i);
    expect(stylesheet).toMatch(/\.match-topbar-button[^{]*\{[^}]*min-inline-size:\s*44px/i);
    // The compact form drops the word, never the target.
    const compactStart = stylesheet.indexOf('@media (max-height: 650px)');
    const compact = stylesheet.slice(compactStart, stylesheet.indexOf('/* ──', compactStart));
    expect(compact).toMatch(/\.match-topbar-label\s*\{\s*display:\s*none/i);
    expect(compact).not.toMatch(/min-block-size|min-inline-size/i);
    // The scrim covers the firing controls, which sit at z-index 4.
    expect(stylesheet).toMatch(/\.match-confirm\s*\{[^}]*z-index:\s*11/i);
  });
});

/* ── A DOM small enough to run in the `node` test environment ─────────────────── */

type FakeListener = (event: { readonly key?: string }) => void;

class FakeDocument {
  private readonly listeners = new Map<string, Set<FakeListener>>();

  get listenerCount(): number {
    return [...this.listeners.values()].reduce((total, set) => total + set.size, 0);
  }

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName, this);
  }

  addEventListener(type: string, listener: FakeListener): void {
    const listeners = this.listeners.get(type) ?? new Set<FakeListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: FakeListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  press(key: string): void {
    for (const listener of [...(this.listeners.get('keydown') ?? [])]) listener({ key });
  }
}

class FakeElement {
  readonly tagName: string;
  readonly ownerDocument: FakeDocument;
  readonly children: FakeElement[] = [];
  parentElement: FakeElement | null = null;
  className = '';
  id = '';
  type = '';
  private ownText = '';
  private readonly attributes = new Map<string, string>();
  private readonly listeners = new Map<string, Set<() => void>>();

  constructor(tagName: string, ownerDocument: FakeDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
  }

  get textContent(): string {
    return this.ownText + this.children.map((child) => child.textContent).join('');
  }

  set textContent(value: string) {
    this.ownText = value;
  }

  append(...children: FakeElement[]): void {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }

  remove(): void {
    const index = this.parentElement?.children.indexOf(this) ?? -1;
    if (index >= 0) this.parentElement!.children.splice(index, 1);
    this.parentElement = null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  addEventListener(type: string, listener: () => void): void {
    const listeners = this.listeners.get(type) ?? new Set<() => void>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  focus(): void {
    // Focus is not observable in this harness; it must simply not throw.
  }

  click(): void {
    // Detached nodes are inert, which is what disposal leaves behind.
    if (!this.isAttached()) return;
    for (const listener of [...(this.listeners.get('click') ?? [])]) listener();
  }

  all(selector: string): FakeElement[] {
    return this.descendants().filter((element) => matches(element, selector));
  }

  first(selector: string): FakeElement | null {
    return this.all(selector)[0] ?? null;
  }

  private isAttached(): boolean {
    let node: FakeElement | null = this;
    while (node.parentElement) node = node.parentElement;
    return node.className === 'root';
  }

  private descendants(): FakeElement[] {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }
}

function createRoot(): FakeElement {
  const root = new FakeDocument().createElement('div');
  root.className = 'root';
  return root;
}

function matches(element: FakeElement, selector: string): boolean {
  if (selector.startsWith('.')) return element.className.split(' ').includes(selector.slice(1));
  const attribute = /^\[([^=\]]+)="([^"]*)"\]$/.exec(selector);
  if (attribute) return element.getAttribute(attribute[1]!) === attribute[2];
  return element.tagName === selector.toUpperCase();
}
