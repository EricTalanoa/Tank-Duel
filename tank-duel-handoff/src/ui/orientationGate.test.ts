import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  isPresentationBlocked,
  mountOrientationGate,
  presentationFit,
} from './orientationGate';

describe('orientation gate', () => {
  it.each([
    [{ width: 768, height: 1024 }, 'portrait'],
    [{ width: 1194, height: 834 }, 'ok'],
    [{ width: 1200, height: 800 }, 'ok'],
    // Landscape but under the iPad floor: the menus reflow to this, the match does not.
    [{ width: 800, height: 600 }, 'compact'],
    [{ width: 852, height: 393 }, 'compact'],
    [{ width: 932, height: 430 }, 'ok'],
  ] as const)('reads %o as its presentation fit', (size, fit) => {
    expect(presentationFit(size)).toBe(fit);
  });

  it.each([
    [{ width: 768, height: 1024 }, true],
    [{ width: 1194, height: 834 }, false],
    // Break caught: a narrow landscape phone walled out of the menus it can now render.
    [{ width: 800, height: 600 }, false],
  ] as const)('blocks %o outright only when nothing can be shown', (size, blocked) => {
    expect(isPresentationBlocked(size)).toBe(blocked);
  });

  it('walls off only the match on a narrow landscape screen, and says which wall it is', () => {
    // Break caught: a phone in landscape being told to rotate a device it has already turned,
    // or the menus being gated on a width only the match actually needs.
    const root = createRoot();
    const viewport = new FakeViewport(852, 393);
    const changes: boolean[] = [];
    let matchActive = false;

    const gate = mountOrientationGate(root as unknown as HTMLElement, viewport as unknown as Window, {
      needsFullWidth: () => matchActive,
      onBlockedChange: (blocked) => changes.push(blocked),
    });

    expect(changes).toEqual([false]);
    expect(root.children).toHaveLength(0);

    matchActive = true;
    gate.refresh();
    expect(changes).toEqual([false, true]);
    expect(root.children[0]?.getAttribute('data-gate')).toBe('compact');
    expect(root.children[0]?.textContent).toContain('Screen too narrow');
    expect(root.children[0]?.textContent).toContain('900px wide');
    expect(root.children[0]?.textContent).not.toContain('Rotate');

    // Turning the phone upright swaps which wall is up without a second notification: the
    // game is already paused, and nothing downstream cares which message is showing.
    viewport.resize(393, 852);
    expect(changes).toEqual([false, true]);
    expect(root.children).toHaveLength(1);
    expect(root.children[0]?.getAttribute('data-gate')).toBe('portrait');
    expect(root.children[0]?.textContent).toContain('Rotate your device');

    matchActive = false;
    viewport.resize(852, 393);
    expect(changes).toEqual([false, true, false]);
    expect(root.children).toHaveLength(0);
    gate.dispose();
  });

  it('notifies once per blocked-state change and restores the exact underlying surface state', () => {
    const root = createRoot();
    root.inert = true;
    root.setAttribute('aria-hidden', 'false');
    const viewport = new FakeViewport(1200, 800);
    const changes: boolean[] = [];

    mountOrientationGate(root as unknown as HTMLElement, viewport as unknown as Window, {
      onBlockedChange: (blocked) => changes.push(blocked),
    });

    expect(changes).toEqual([false]);
    expect(root.inert).toBe(true);
    expect(root.getAttribute('aria-hidden')).toBe('false');

    viewport.resize(768, 1024);
    viewport.dispatch('orientationchange');
    expect(changes).toEqual([false, true]);
    expect(root.inert).toBe(true);
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.children).toHaveLength(1);
    expect(root.children[0]?.getAttribute('role')).toBe('alertdialog');
    expect(root.children[0]?.textContent).toContain('Rotate your device');
    expect(root.children[0]?.textContent).toContain('Turn your device sideways');

    viewport.resize(1200, 800);
    expect(changes).toEqual([false, true, false]);
    expect(root.children).toHaveLength(0);
    expect(root.inert).toBe(true);
    expect(root.getAttribute('aria-hidden')).toBe('false');
  });

  it('removes listeners and restores absent inert and ARIA attributes once when disposed while blocked', () => {
    const root = createRoot();
    const viewport = new FakeViewport(768, 1024);
    const changes: boolean[] = [];
    const gate = mountOrientationGate(root as unknown as HTMLElement, viewport as unknown as Window, {
      onBlockedChange: (blocked) => changes.push(blocked),
    });

    expect(changes).toEqual([true]);
    expect(root.inert).toBe(true);
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(viewport.listenerCount('resize')).toBe(1);
    expect(viewport.listenerCount('orientationchange')).toBe(1);

    gate.dispose();
    gate.dispose();
    viewport.resize(1200, 800);

    expect(root.children).toHaveLength(0);
    expect(root.inert).toBe(false);
    expect(root.hasAttribute('aria-hidden')).toBe(false);
    expect(viewport.listenerCount('resize')).toBe(0);
    expect(viewport.listenerCount('orientationchange')).toBe(0);
    expect(changes).toEqual([true]);
  });

  it('covers tablet safe areas without relying on hover-only interaction', () => {
    const stylesheet = readFileSync(new URL('./orientationGate.css', import.meta.url), 'utf8');

    expect(stylesheet).toMatch(/\.orientation-gate[^{]*\{[^}]*position:\s*fixed/i);
    expect(stylesheet).toMatch(/\.orientation-gate[^{]*\{[^}]*inset:\s*0/i);
    expect(stylesheet).toMatch(/env\(safe-area-inset-top\)/i);
    expect(stylesheet).not.toMatch(/:hover/i);
  });
});

type Listener = () => void;

class FakeViewport {
  innerWidth: number;
  innerHeight: number;
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(width: number, height: number) {
    this.innerWidth = width;
    this.innerHeight = height;
  }

  addEventListener(type: string, listener: Listener): void {
    const listeners = this.listeners.get(type) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  resize(width: number, height: number): void {
    this.innerWidth = width;
    this.innerHeight = height;
    this.dispatch('resize');
  }

  dispatch(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName, this);
  }
}

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly ownerDocument: FakeDocument;
  parentElement: FakeElement | null = null;
  className = '';
  inert = false;
  private ownText = '';
  private readonly attributes = new Map<string, string>();

  constructor(readonly tagName: string, document: FakeDocument) {
    this.ownerDocument = document;
  }

  get textContent(): string {
    return this.ownText + this.children.map((child) => child.textContent).join('');
  }

  set textContent(value: string) {
    this.ownText = value;
    this.children.splice(0, this.children.length);
  }

  append(...children: FakeElement[]): void {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }

  remove(): void {
    if (!this.parentElement) return;
    const index = this.parentElement.children.indexOf(this);
    if (index >= 0) this.parentElement.children.splice(index, 1);
    this.parentElement = null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
}

function createRoot(): FakeElement {
  return new FakeDocument().createElement('main');
}
