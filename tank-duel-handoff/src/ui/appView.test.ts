import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultConfig } from './config';
import { createFlow, reduceFlow, type AppFlowState, type FlowAction } from './flow';
import { mountAppView } from './appView';

describe('application DOM view', () => {
  it('renders labelled semantic TITLE controls and dispatches one exact action after rerenders', () => {
    const root = createRoot();
    const onAction = vi.fn<(action: FlowAction) => void>();
    const view = mountAppView(root as unknown as HTMLElement, { onAction });
    const title = createFlow(createDefaultConfig());

    view.render(title);
    view.render(title);

    expect(root.first('[aria-label="Tank Duel"]')?.tagName).toBe('SECTION');
    expect(root.all('button').map((button) => button.textContent)).toEqual([
      'Quick Start',
      'Custom Game',
      'How to Play',
      'Settings',
    ]);
    expect(root.all('button').at(-1)?.disabled).toBe(true);
    expect(root.ownerDocument.activeElement?.tagName).toBe('H1');
    root.click(root.all('button')[0]!);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenLastCalledWith({ type: 'quickStart' });
  });

  it('renders Random and enabled CPU mode as keyboard-operable MAP buttons', () => {
    const root = createRoot();
    const onAction = vi.fn<(action: FlowAction) => void>();
    const view = mountAppView(root as unknown as HTMLElement, { onAction });
    const map = reduceFlow(createFlow(createDefaultConfig()), { type: 'quickStart' });

    view.render(map);

    const random = root.all('button').find((button) => button.getAttribute('data-world-id') === 'random');
    const cpu = root.all('button').find((button) => button.textContent.includes('1 v CPU'));
    expect(random?.textContent).toContain('Random');
    expect(cpu?.disabled).toBe(false);
    expect(cpu?.textContent).not.toContain('Task 12');
    expect(random?.getAttribute('type')).toBe('button');
    root.click(random!);
    expect(onAction).toHaveBeenLastCalledWith({ type: 'selectMap', worldId: 'random' });
  });

  it('shows enabled CPU selection and labelled, locked HE controls with shell icons', () => {
    const root = createRoot();
    const view = mountAppView(root as unknown as HTMLElement, { onAction: vi.fn() });
    const title = createFlow(createDefaultConfig());

    view.render(reduceFlow(title, { type: 'openMode' }));
    const cpu = root.all('button').find((button) => button.textContent.includes('1 v CPU'));
    expect(cpu?.disabled).toBe(false);
    expect(cpu?.textContent).not.toContain('Task 12');

    view.render(reduceFlow(title, { type: 'openCustom' }));
    const heToggle = root.first('[data-shell-toggle="he"]');
    const heCount = root.first('[data-shell-ammo="he"]');
    expect(heToggle?.tagName).toBe('INPUT');
    expect(heToggle?.disabled).toBe(true);
    expect(heCount?.disabled).toBe(true);
    expect(heCount?.value).toBe('∞');
    expect(root.first('img[src="/assets/icons/he.svg"]')).not.toBeNull();
    expect(root.all('label').some((label) => label.textContent.includes('HE Shell'))).toBe(true);
  });

  it('renders ordered CPU tier buttons with selected state and dispatches tier actions', () => {
    const root = createRoot();
    const onAction = vi.fn<(action: FlowAction) => void>();
    const view = mountAppView(root as unknown as HTMLElement, { onAction });
    const map = reduceFlow(createFlow(createDefaultConfig()), { type: 'quickStart' });
    const cpuMap: AppFlowState = {
      ...map,
      config: { ...map.config, mode: 'cpu', cpuTierId: 'veteran' },
    };

    view.render(cpuMap);

    const tiers = root.all('button').filter((button) => button.getAttribute('data-cpu-tier') !== null);
    expect(tiers.map((button) => button.textContent)).toEqual(['Recruit', 'Gunner', 'Veteran']);
    expect(tiers.map((button) => button.getAttribute('type'))).toEqual(['button', 'button', 'button']);
    expect(tiers.map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true']);
    expect(tiers.every((button) => !button.disabled)).toBe(true);

    root.click(tiers[0]!);
    expect(onAction).toHaveBeenLastCalledWith({ type: 'selectCpuTier', cpuTierId: 'recruit' });
  });

  it('omits the CPU difficulty group entirely in local mode and styles it when shown', () => {
    const root = createRoot();
    const view = mountAppView(root as unknown as HTMLElement, { onAction: vi.fn() });
    const title = createFlow(createDefaultConfig());
    const localMap = reduceFlow(title, { type: 'quickStart' });

    view.render(localMap);
    expect(localMap.config.mode).toBe('local');
    expect(root.all('button').filter((button) => button.getAttribute('data-cpu-tier') !== null)).toHaveLength(0);
    expect(root.all('fieldset')).toHaveLength(0);

    view.render({ ...localMap, config: { ...localMap.config, mode: 'cpu' } });
    expect(root.all('button').filter((button) => button.getAttribute('data-cpu-tier') !== null)).toHaveLength(3);

    const stylesheet = readFileSync(fileURLToPath(new URL('./menu.css', import.meta.url)), 'utf8');
    expect(stylesheet).toMatch(/\.cpu-tier-controls[^{]*\{[^}]*border:/i);
    expect(stylesheet).toMatch(/\.cpu-tier-controls legend[^{]*\{[^}]*color:/i);
  });

  it('dispatches validated custom config changes without owning navigation', () => {
    const root = createRoot();
    const onAction = vi.fn<(action: FlowAction) => void>();
    const onConfigChange = vi.fn();
    const view = mountAppView(root as unknown as HTMLElement, { onAction, onConfigChange });
    const custom = reduceFlow(createFlow(createDefaultConfig()), { type: 'openCustom' });
    view.render(custom);

    const rounds = root.first('[data-config-field="rounds"]')!;
    rounds.value = '5';
    root.change(rounds);
    expect(onConfigChange).toHaveBeenCalledTimes(1);
    expect(onConfigChange.mock.calls[0]![0]).toMatchObject({ rounds: 5, path: 'custom' });
    expect(onAction).not.toHaveBeenCalled();

    const seed = root.first('[data-config-field="seed"]')!;
    seed.value = '12345';
    root.input(seed);
    expect(onConfigChange).toHaveBeenCalledTimes(2);
    expect(onConfigChange.mock.calls[1]![0]).toMatchObject({ seed: 12345, path: 'custom' });

    root.click(root.all('button').find((button) => button.textContent === 'Start match')!);
    expect(onAction).toHaveBeenLastCalledWith({ type: 'startCustom' });
  });

  it('renders icon-bearing ROUND_INTRO and ROUND_OVER shell summaries safely', () => {
    const root = createRoot();
    const view = mountAppView(root as unknown as HTMLElement, { onAction: vi.fn() });
    const config = createDefaultConfig();
    const title = createFlow(config);
    const intro = reduceFlow(
      reduceFlow(title, { type: 'quickStart' }),
      { type: 'selectMap', worldId: 'terra' },
    );

    view.render(intro);
    expect(root.all('img').map((image) => image.getAttribute('src'))).toEqual(
      config.enabledShellIds.map((id) => `/${config.shells[id]!.icon}`),
    );

    const unsafeName = '<img src=x onerror=alert(1)>';
    const unsafeConfig = {
      ...config,
      shells: {
        ...config.shells,
        mortar: { ...config.shells.mortar!, name: unsafeName },
      },
    };
    const roundOver: AppFlowState = {
      ...title,
      screen: 'ROUND_OVER',
      config: unsafeConfig,
      roundOver: { spentShellIdsByPlayer: [['mortar']] },
    };
    view.render(roundOver);
    expect(root.textContent).toContain(unsafeName);
    expect(root.all('img')).toHaveLength(1);
    expect(root.all('img')[0]?.getAttribute('src')).toBe('/assets/icons/mortar.svg');
  });

  it('disposes idempotently and removes delegated handlers', () => {
    const root = createRoot();
    const onAction = vi.fn<(action: FlowAction) => void>();
    const view = mountAppView(root as unknown as HTMLElement, { onAction });
    view.render(createFlow(createDefaultConfig()));
    const button = root.all('button')[0]!;

    view.dispose();
    view.dispose();
    root.click(button);
    view.render(createFlow(createDefaultConfig()));

    expect(onAction).not.toHaveBeenCalled();
    expect(root.children).toHaveLength(0);
  });
});

class FakeDocument {
  activeElement: FakeElement | null = null;

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName, this);
  }
}

type FakeListener = (event: { readonly target: FakeElement }) => void;

class FakeElement {
  readonly tagName: string;
  readonly ownerDocument: FakeDocument;
  readonly children: FakeElement[] = [];
  parentElement: FakeElement | null = null;
  className = '';
  disabled = false;
  checked = false;
  value = '';
  private ownText = '';
  private readonly attributes = new Map<string, string>();
  private readonly listeners = new Map<string, Set<FakeListener>>();

  constructor(tagName: string, ownerDocument: FakeDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
  }

  get textContent(): string {
    return this.ownText + this.children.map((child) => child.textContent).join('');
  }

  set textContent(value: string) {
    this.replaceChildren();
    this.ownText = value;
  }

  append(...children: FakeElement[]): void {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }

  replaceChildren(...children: FakeElement[]): void {
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
    if (name === 'disabled') this.disabled = true;
    if (name === 'value') this.value = value;
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<FakeListener>();
    listeners.add(listener as unknown as FakeListener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener as unknown as FakeListener);
  }

  contains(candidate: FakeElement): boolean {
    return candidate === this || this.children.some((child) => child.contains(candidate));
  }

  closest(selector: string): FakeElement | null {
    let candidate: FakeElement | null = this;
    while (candidate) {
      if (matches(candidate, selector)) return candidate;
      candidate = candidate.parentElement;
    }
    return null;
  }

  all(selector: string): FakeElement[] {
    return this.descendants().filter((element) => matches(element, selector));
  }

  first(selector: string): FakeElement | null {
    return this.all(selector)[0] ?? null;
  }

  querySelector(selector: string): FakeElement | null {
    return this.first(selector);
  }

  focus(): void {
    this.ownerDocument.activeElement = this;
  }

  click(target: FakeElement): void {
    if (target.disabled) return;
    this.dispatch('click', target);
  }

  change(target: FakeElement): void {
    if (target.disabled) return;
    this.dispatch('change', target);
  }

  input(target: FakeElement): void {
    if (target.disabled) return;
    this.dispatch('input', target);
  }

  private descendants(): FakeElement[] {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }

  private dispatch(type: string, target: FakeElement): void {
    for (const listener of this.listeners.get(type) ?? []) listener({ target });
  }
}

function createRoot(): FakeElement {
  const document = new FakeDocument();
  return document.createElement('div');
}

function matches(element: FakeElement, selector: string): boolean {
  if (selector.includes(',')) {
    return selector.split(',').some((part) => matches(element, part.trim()));
  }
  const attribute = /^(?:(\w+))?\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(selector);
  if (attribute) {
    const [, tagName, name, value] = attribute;
    if (tagName && element.tagName !== tagName.toUpperCase()) return false;
    const actual = element.getAttribute(name!);
    return actual !== null && (value === undefined || actual === value);
  }
  return element.tagName === selector.toUpperCase();
}
