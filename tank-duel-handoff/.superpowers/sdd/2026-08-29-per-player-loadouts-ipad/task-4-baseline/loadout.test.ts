import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { createLoadout } from '../sim/loadout';
import { deploymentShellIds, loadoutCardModels, mountLoadout } from './loadout';
import { deckChipModels } from '../render/hud';
import { makePlayerLoadouts } from '../sim/playerLoadouts';
import { createWorld } from '../sim/world';

describe('loadout UI model', () => {
  it('pairs every shell name with its imported icon and state', () => {
    const cards = loadoutCardModels(createLoadout(['mortar', 'cluster']));
    expect(cards.length).toBeGreaterThan(2);
    expect(cards.every((card) => card.name.length > 0 && card.icon.endsWith('.svg'))).toBe(true);
    expect(cards.find((card) => card.id === 'he')).toMatchObject({ locked: true, selected: true });
    expect(cards.find((card) => card.id === 'mortar')?.selected).toBe(true);
  });

  it('limits cards to enabled config shells while retaining HE in spec slot order', () => {
    const loadout = createLoadout(['skipper', 'cluster', 'mortar']);
    const enabledShellIds = ['cluster', 'mortar'];

    expect(loadoutCardModels(loadout, enabledShellIds).map((card) => card.id)).toEqual([
      'he',
      'mortar',
      'cluster',
    ]);
    expect(deploymentShellIds(loadout, enabledShellIds)).toEqual([
      'he',
      'mortar',
      'cluster',
    ]);
  });

  it('exposes explicit focus-visible treatment for loadout cards and deploy without styling disabled controls', () => {
    const stylesheet = readFileSync(fileURLToPath(new URL('./loadout.css', import.meta.url)), 'utf8');

    expect(stylesheet).toMatch(/\.loadout-card:focus-visible:not\(:disabled\)[^{]*\{[^}]*outline:\s*3px solid/i);
    expect(stylesheet).toMatch(/\.deploy:focus-visible:not\(:disabled\)[^{]*\{[^}]*outline:\s*3px solid/i);
    expect(stylesheet).not.toMatch(/\.loadout-card:disabled[^{]*\{[^}]*outline\s*:/i);
    expect(stylesheet).not.toMatch(/\.deploy:disabled[^{]*\{[^}]*outline\s*:/i);
  });

  it('pairs stable in-match chip names with icons and spent state', () => {
    const state = createWorld(7, {
      playerLoadoutIds: makePlayerLoadouts(['he', 'mortar'], ['he', 'mortar']),
    });
    state.arsenals[0].ammo.mortar = 0;
    const chips = deckChipModels(state);
    expect(chips.every((chip) => chip.name.length > 0 && chip.icon.endsWith('.svg'))).toBe(true);
    expect(chips[1]).toMatchObject({ name: 'Heavy Mortar', spent: true, key: 2 });
  });

  it('returns an idempotent owner that removes the overlay and its delegated listener', () => {
    const root = createDomRoot();
    let deployments = 0;
    const owner = mountLoadout(root as unknown as HTMLElement, {
      onDeploy: () => { deployments++; },
    });
    const overlay = root.children[0]!;
    const deploy = overlay.first('[data-deploy]')!;

    expect(overlay.listenerCount('click')).toBe(1);
    owner.dispose();
    owner.dispose();
    overlay.click(deploy);

    expect(root.children).toHaveLength(0);
    expect(overlay.listenerCount('click')).toBe(0);
    expect(deployments).toBe(0);
  });

  it('removes the overlay listener before deployment changes the application screen', () => {
    const root = createDomRoot();
    let deployedIds: readonly string[] = [];
    mountLoadout(root as unknown as HTMLElement, {
      onDeploy: (ids) => { deployedIds = ids; },
      initialShellIds: ['he', 'mortar'],
    });
    const overlay = root.children[0]!;

    overlay.click(overlay.first('[data-deploy]')!);

    expect(deployedIds).toEqual(['he', 'mortar']);
    expect(root.children).toHaveLength(0);
    expect(overlay.listenerCount('click')).toBe(0);
  });
});

class LoadoutFakeDocument {
  createElement(tagName: string): LoadoutFakeElement {
    return new LoadoutFakeElement(tagName, this);
  }
}

type LoadoutFakeListener = (event: { readonly target: LoadoutFakeElement }) => void;

class LoadoutFakeElement {
  readonly ownerDocument: LoadoutFakeDocument;
  readonly children: LoadoutFakeElement[] = [];
  parentElement: LoadoutFakeElement | null = null;
  className = '';
  disabled = false;
  type = '';
  src = '';
  alt = '';
  private ownText = '';
  private readonly attributes = new Map<string, string>();
  private readonly listeners = new Map<string, Set<LoadoutFakeListener>>();

  constructor(readonly tagName: string, ownerDocument: LoadoutFakeDocument) {
    this.ownerDocument = ownerDocument;
  }

  get textContent(): string {
    return this.ownText + this.children.map((child) => child.textContent).join('');
  }

  set textContent(value: string) {
    this.replaceChildren();
    this.ownText = value;
  }

  append(...children: LoadoutFakeElement[]): void {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }

  replaceChildren(...children: LoadoutFakeElement[]): void {
    for (const child of this.children) child.parentElement = null;
    this.children.splice(0, this.children.length);
    this.ownText = '';
    this.append(...children);
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

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<LoadoutFakeListener>();
    listeners.add(listener as unknown as LoadoutFakeListener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener as unknown as LoadoutFakeListener);
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }

  contains(candidate: LoadoutFakeElement): boolean {
    return candidate === this || this.children.some((child) => child.contains(candidate));
  }

  closest(selector: string): LoadoutFakeElement | null {
    let candidate: LoadoutFakeElement | null = this;
    while (candidate) {
      if (matchesLoadoutElement(candidate, selector)) return candidate;
      candidate = candidate.parentElement;
    }
    return null;
  }

  first(selector: string): LoadoutFakeElement | null {
    return this.descendants().find((element) => matchesLoadoutElement(element, selector)) ?? null;
  }

  click(target: LoadoutFakeElement): void {
    for (const listener of this.listeners.get('click') ?? []) listener({ target });
  }

  private descendants(): LoadoutFakeElement[] {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }
}

function createDomRoot(): LoadoutFakeElement {
  const document = new LoadoutFakeDocument();
  return document.createElement('div');
}

function matchesLoadoutElement(element: LoadoutFakeElement, selector: string): boolean {
  if (selector.includes(',')) {
    return selector.split(',').some((part) => matchesLoadoutElement(element, part.trim()));
  }
  const attribute = /^\[([^\]]+)\]$/.exec(selector);
  return attribute ? element.hasAttribute(attribute[1]!) : false;
}
