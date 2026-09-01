import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { CONSTANTS } from '../sim/constants';
import { createLoadout } from '../sim/loadout';
import { PRESENTATION } from '../render/presentation';
import {
  createPlayerLoadoutEditorModel,
  deploymentShellIds,
  loadoutCardModels,
  mountLoadout,
} from './loadout';
import { deckChipModels } from '../render/hud';
import { makePlayerLoadouts } from '../sim/playerLoadouts';
import { createWorld } from '../sim/world';
import { STANDARD_SHELL_IDS } from '../sim/weapons';

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

  it('keeps Player 2 untouched when Player 1 changes its independently owned deck', () => {
    const model = createPlayerLoadoutEditorModel({
      initialPlayerLoadoutIds: makePlayerLoadouts(
        ['he', 'mortar'],
        ['he', 'sand', 'roller'],
      ),
    });
    const beforePlayerTwo = structuredClone(model.players[1].deploymentIds);

    model.toggle(0, 'cluster');

    expect(model.players[0].deploymentIds).toEqual(['he', 'mortar', 'cluster']);
    expect(model.players[1].deploymentIds).toEqual(beforePlayerTwo);
    expect(model.players[0].validation.pointsUsed).toBe(5);
    expect(model.players[1].validation.pointsUsed).toBe(3);
  });

  it('keeps Player 1 untouched when Player 2 changes its independently owned deck', () => {
    const model = createPlayerLoadoutEditorModel({
      initialPlayerLoadoutIds: makePlayerLoadouts(
        ['he', 'mortar', 'cluster'],
        ['he', 'sand'],
      ),
    });
    const beforePlayerOne = structuredClone(model.players[0].deploymentIds);

    model.toggle(1, 'roller');

    expect(model.players[0].deploymentIds).toEqual(beforePlayerOne);
    expect(model.players[1].deploymentIds).toEqual(['he', 'roller', 'sand']);
  });

  it('pins CPU mode to the complete standard deck while keeping only Player 1 editable', () => {
    const model = createPlayerLoadoutEditorModel({
      mode: 'cpu',
      cpuTierId: 'veteran',
      initialPlayerLoadoutIds: makePlayerLoadouts(
        ['he', 'mortar'],
        ['he', 'sand'],
      ),
    });
    const cpuBefore = structuredClone(model.players[1].deploymentIds);

    model.toggle(0, 'cluster');
    model.toggle(1, 'sand');

    expect(model.players[0].editable).toBe(true);
    expect(model.players[1].editable).toBe(false);
    expect(model.players[1].deploymentIds).toEqual(STANDARD_SHELL_IDS);
    expect(model.players[1].deploymentIds).toEqual(cpuBefore);
    expect(model.deployment()).toEqual([
      ['he', 'mortar', 'cluster'],
      STANDARD_SHELL_IDS,
    ]);
  });

  it('copies caller decks and returns separately frozen player deployments', () => {
    const callerDecks: [string[], string[]] = [
      ['he', 'mortar'],
      ['he', 'sand'],
    ];
    const model = createPlayerLoadoutEditorModel({
      initialPlayerLoadoutIds: callerDecks as ReturnType<typeof makePlayerLoadouts>,
    });
    callerDecks[0]!.push('cluster');
    callerDecks[1]!.push('roller');

    const deployed = model.deployment();

    expect(deployed).toEqual([['he', 'mortar'], ['he', 'sand']]);
    expect(Object.isFrozen(deployed)).toBe(true);
    expect(Object.isFrozen(deployed[0])).toBe(true);
    expect(Object.isFrozen(deployed[1])).toBe(true);
  });

  it('uses the same enabled-shell filter and locked HE card in both panels', () => {
    const model = createPlayerLoadoutEditorModel({
      enabledShellIds: ['mortar', 'sand'],
      initialPlayerLoadoutIds: makePlayerLoadouts(
        ['he', 'mortar'],
        ['he', 'sand'],
      ),
    });

    expect(model.players.map((player) => player.cards.map((card) => card.id))).toEqual([
      ['he', 'mortar', 'sand'],
      ['he', 'mortar', 'sand'],
    ]);
    expect(model.players.map((player) => player.cards[0])).toEqual([
      expect.objectContaining({ id: 'he', locked: true, selected: true, cost: 0 }),
      expect.objectContaining({ id: 'he', locked: true, selected: true, cost: 0 }),
    ]);
    expect(model.canDeploy).toBe(model.players.every((player) => player.validation.valid));
  });

  it('exposes explicit focus-visible treatment for loadout cards and deploy without styling disabled controls', () => {
    const stylesheet = readFileSync(fileURLToPath(new URL('./loadout.css', import.meta.url)), 'utf8');

    expect(stylesheet).toMatch(/\.loadout-card:focus-visible:not\(:disabled\)[^{]*\{[^}]*outline:\s*3px solid/i);
    expect(stylesheet).toMatch(/\.deploy:focus-visible:not\(:disabled\)[^{]*\{[^}]*outline:\s*3px solid/i);
    expect(stylesheet).not.toMatch(/\.loadout-card:disabled[^{]*\{[^}]*outline\s*:/i);
    expect(stylesheet).not.toMatch(/\.deploy:disabled[^{]*\{[^}]*outline\s*:/i);
  });

  it('sets 44px minimum targets and landscape two-panel/safe-area layout in CSS', () => {
    const stylesheet = readFileSync(fileURLToPath(new URL('./loadout.css', import.meta.url)), 'utf8');

    expect(stylesheet).toMatch(/\.loadout-card[^{]*\{[^}]*min-height:\s*(?:96|44)px/i);
    expect(stylesheet).toMatch(/\.loadout-card[^{]*\{[^}]*min-width:\s*44px/i);
    expect(stylesheet).toMatch(/\.deploy[^{]*\{[^}]*min-height:\s*44px/i);
    expect(stylesheet).toMatch(/\.deploy[^{]*\{[^}]*min-width:\s*44px/i);
    expect(stylesheet).toMatch(/\.loadout-panels[^{]*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/i);
    expect(stylesheet).toMatch(/padding:\s*calc\([^)]*env\(safe-area-inset-top\)/i);
    expect(stylesheet).toMatch(/\.loadout-panels\.is-cpu[^{]*\{[^}]*grid-template-columns:/i);
    expect(stylesheet).toMatch(/\.cpu-loadout-summary[^{]*\{[^}]*border:/i);
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

  it('renders two spec-labelled neutral regions with independent counters and one shared deploy', () => {
    const root = createDomRoot();
    mountLoadout(root as unknown as HTMLElement, {
      initialPlayerLoadoutIds: makePlayerLoadouts(
        ['he', 'mortar', 'cluster'],
        ['he', 'sand'],
      ),
      onDeploy: () => {},
    });
    const overlay = root.children[0]!;

    expect(overlay.all('[data-player]')).toHaveLength(2);
    const heCards = overlay.all('[data-shell]').filter((card) => card.getAttribute('data-shell') === 'he');
    expect(heCards).toHaveLength(2);
    expect(heCards.every((card) => card.disabled)).toBe(true);
    expect(overlay.all('output').map((counter) => counter.textContent)).toEqual([
      `5/${CONSTANTS.loadout.points} POINTS · 2/${CONSTANTS.loadout.slots} SLOTS`,
      `1/${CONSTANTS.loadout.points} POINTS · 1/${CONSTANTS.loadout.slots} SLOTS`,
    ]);
    expect(overlay.textContent).toContain(PRESENTATION.players[0].label);
    expect(overlay.textContent).toContain(PRESENTATION.players[1].label);
    expect(overlay.all('[data-deploy]')).toHaveLength(1);
    expect(overlay.first('[data-deploy]')?.disabled).toBe(false);
  });

  it('renders a neutral icon-bearing CPU summary without a second editable panel', () => {
    const root = createDomRoot();
    mountLoadout(root as unknown as HTMLElement, {
      mode: 'cpu',
      cpuTierId: 'gunner',
      initialPlayerLoadoutIds: makePlayerLoadouts(['he', 'mortar'], ['he', 'sand']),
      onDeploy: () => {},
    });
    const overlay = root.children[0]!;
    const summary = overlay.first('[data-cpu-summary]')!;

    expect(overlay.all('[data-player]')).toHaveLength(1);
    expect(overlay.all('[data-cpu-summary]')).toHaveLength(1);
    expect(overlay.all('[data-shell]')).not.toHaveLength(0);
    expect(summary.all('[data-shell]')).toHaveLength(0);
    expect(summary.all('img').map((image) => image.src)).toEqual(
      STANDARD_SHELL_IDS.map((id) => `/assets/icons/${id}.svg`),
    );
    expect(summary.textContent).toContain('Gunner');
    expect(overlay.all('[data-deploy]')).toHaveLength(1);
  });

  it('deploys both distinct decks in stable player order after disposing the shared owner', () => {
    const root = createDomRoot();
    let deployed = makePlayerLoadouts(['he'], ['he']);
    mountLoadout(root as unknown as HTMLElement, {
      initialPlayerLoadoutIds: makePlayerLoadouts(
        ['he', 'mortar'],
        ['he', 'sand', 'roller'],
      ),
      onDeploy: (loadouts) => { deployed = loadouts; },
    });
    const overlay = root.children[0]!;

    overlay.click(overlay.first('[data-deploy]')!);

    expect(deployed).toEqual([
      ['he', 'mortar'],
      ['he', 'roller', 'sand'],
    ]);
    expect(root.children).toHaveLength(0);
    expect(overlay.listenerCount('click')).toBe(0);
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
    let deployedLoadouts = makePlayerLoadouts(['he'], ['he']);
    mountLoadout(root as unknown as HTMLElement, {
      onDeploy: (loadouts) => { deployedLoadouts = loadouts; },
      initialPlayerLoadoutIds: makePlayerLoadouts(['he', 'mortar'], ['he', 'sand']),
    });
    const overlay = root.children[0]!;

    overlay.click(overlay.first('[data-deploy]')!);

    expect(deployedLoadouts).toEqual([['he', 'mortar'], ['he', 'sand']]);
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

  all(selector: string): LoadoutFakeElement[] {
    return this.descendants().filter((element) => matchesLoadoutElement(element, selector));
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
  return attribute ? element.hasAttribute(attribute[1]!) : element.tagName === selector;
}
