import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  isPresentationBlocked,
  mountOrientationGate,
} from './orientationGate';

describe('orientation gate', () => {
  it.each([
    [{ width: 768, height: 1024 }, true],
    [{ width: 1194, height: 834 }, false],
    [{ width: 800, height: 600 }, true],
    [{ width: 1200, height: 800 }, false],
    // A phone in landscape is playable now; the design is scaled to fit it. 812 is the
    // boundary, so it passes and everything under it does not.
    [{ width: 812, height: 375 }, false],
    [{ width: 844, height: 390 }, false],
    [{ width: 811, height: 375 }, true],
  ] as const)('blocks %o exactly when the presentation cannot be shown', (size, blocked) => {
    expect(isPresentationBlocked(size)).toBe(blocked);
  });

  it('notifies once per blocked-state change and restores the exact underlying surface state', () => {
    const root = createRoot();
    root.inert = true;
    root.setAttribute('aria-hidden', 'false');
    const viewport = new FakeViewport(1200, 800);
    const changes: boolean[] = [];

    mountOrientationGate(root as unknown as HTMLElement, viewport as unknown as Window, (blocked) => {
      changes.push(blocked);
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
    expect(root.children[0]?.textContent).toContain('Turn it to landscape');

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
    const gate = mountOrientationGate(root as unknown as HTMLElement, viewport as unknown as Window, (blocked) => {
      changes.push(blocked);
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
