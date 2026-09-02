import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { CREW_COLOR_OPTIONS, createDefaultConfig, withCrewName, type MatchConfig } from './config';
import { createFlow, reduceFlow, type AppFlowState, type FlowAction } from './flow';
import { mountAppView } from './appView';

/** TITLE -> MODE, the first step of the quick-start path. */
function modeState(): AppFlowState {
  return reduceFlow(createFlow(createDefaultConfig()), { type: 'quickStart' });
}

/** TITLE -> MODE -> CREW. */
function crewState(): AppFlowState {
  return reduceFlow(modeState(), { type: 'confirmMode' });
}

/** TITLE -> MODE -> CREW -> MAP, with both crews named. */
function mapState(): AppFlowState {
  const crew = crewState();
  const named = withCrewName(withCrewName(crew.config, 0, 'Ash'), 1, 'Vale');
  return reduceFlow({ ...crew, config: named }, { type: 'confirmCrews' });
}

describe('application DOM view', () => {

  it('renders the crew panels as real inputs and swatch buttons, with names optional', () => {
    const root = createRoot();
    const onAction = vi.fn<(action: FlowAction) => void>();
    const onConfigChange = vi.fn<(config: MatchConfig) => void>();
    const view = mountAppView(root as unknown as HTMLElement, { onAction, onConfigChange });
    const crew = crewState();

    view.render(crew);

    // Nothing typed, and Continue still works: Player 1 and Player 2 are the defaults.
    const continueButton = root.all('button').find((b) => b.getAttribute('aria-label') === 'Continue');
    expect(continueButton?.disabled).toBe(false);
    root.click(continueButton!);
    expect(onAction).toHaveBeenLastCalledWith({ type: 'confirmCrews' });

    // Every control is a real input or button, so the screen is keyboard-operable.
    const names = root.all('input');
    expect(names).toHaveLength(2);
    expect(names.map((input) => input.getAttribute('maxlength'))).toEqual(['14', '14']);
    expect(names.map((input) => input.getAttribute('placeholder'))).toEqual(['Player 1', 'Player 2']);

    names[0]!.value = 'Ash';
    root.input(names[0]!);
    expect(onConfigChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ crews: [{ name: 'Ash', color: crew.config.crews[0].color }, crew.config.crews[1]] }),
    );

    const swatches = root.all('button').filter((b) => b.className.startsWith('crew-swatch'));
    expect(swatches).toHaveLength(CREW_COLOR_OPTIONS.length * 2);
    expect(swatches.filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(2);
    root.click(swatches[2]!);
    expect(onAction).toHaveBeenLastCalledWith({
      type: 'selectCrewColor',
      player: 0,
      color: CREW_COLOR_OPTIONS[2],
    });
  });

  it('gives the CPU crew neither a name field nor a colour picker', () => {
    const root = createRoot();
    const onAction = vi.fn<(action: FlowAction) => void>();
    const view = mountAppView(root as unknown as HTMLElement, { onAction });
    const crew = crewState();
    const cpu = reduceFlow(
      { ...crew, config: withCrewName(crew.config, 0, 'Ash') },
      { type: 'selectMode', mode: 'cpu' },
    );

    view.render(cpu);

    // One field, one picker, one crew: two permanently disabled controls on the CPU panel
    // would read as broken rather than as absent by design.
    const names = root.all('input');
    expect(names).toHaveLength(1);
    expect(names[0]?.getAttribute('data-crew-name')).toBe('0');
    const swatches = root.all('button').filter((b) => b.className.startsWith('crew-swatch'));
    expect(swatches).toHaveLength(CREW_COLOR_OPTIONS.length);
    expect(root.all('p').some((p) => p.className === 'crew-note')).toBe(true);

    const continueButton = root.all('button').find((b) => b.getAttribute('aria-label') === 'Continue');
    expect(continueButton?.disabled).toBe(false);
    root.click(continueButton!);
    expect(onAction).toHaveBeenLastCalledWith({ type: 'confirmCrews' });
  });

  it('selects a mode on MODE without navigating, and advances on Continue', () => {
    const root = createRoot();
    const onAction = vi.fn<(action: FlowAction) => void>();
    const view = mountAppView(root as unknown as HTMLElement, { onAction });

    view.render(modeState());

    const cpuCard = root.all('button').find((b) => b.getAttribute('data-mode') === 'cpu');
    expect(cpuCard?.getAttribute('aria-pressed')).toBe('false');
    root.click(cpuCard!);
    expect(onAction).toHaveBeenLastCalledWith({ type: 'selectMode', mode: 'cpu' });

    // Difficulty is chosen on this screen once CPU is the selection, not two screens later.
    view.render(reduceFlow(modeState(), { type: 'selectMode', mode: 'cpu' }));
    expect(root.all('button').filter((b) => b.getAttribute('data-cpu-tier') !== null)).toHaveLength(3);

    const continueButton = root.all('button').find((b) => b.getAttribute('aria-label') === 'Continue');
    root.click(continueButton!);
    expect(onAction).toHaveBeenLastCalledWith({ type: 'confirmMode' });
  });

  it('renders a working Back button on every DOM-rendered pre-match page after TITLE', () => {
    const root = createRoot();
    const onAction = vi.fn<(action: FlowAction) => void>();
    const view = mountAppView(root as unknown as HTMLElement, { onAction });
    const title = createFlow(createDefaultConfig());
    const states = [
      modeState(),
      crewState(),
      reduceFlow(title, { type: 'openCustom' }),
      mapState(),
      reduceFlow(title, { type: 'openHowTo' }),
    ];

    for (const state of states) {
      view.render(state);
      const back = root.all('button').find((button) => button.getAttribute('aria-label') === 'Back');
      expect(back, `${state.screen} is missing Back`).toBeDefined();
      root.click(back!);
      expect(onAction).toHaveBeenLastCalledWith({ type: 'back' });
    }
  });

  it('renders labelled semantic TITLE controls and dispatches one exact action after rerenders', () => {
    const root = createRoot();
    const onAction = vi.fn<(action: FlowAction) => void>();
    const view = mountAppView(root as unknown as HTMLElement, { onAction });
    const title = createFlow(createDefaultConfig());

    view.render(title);
    view.render(title);

    expect(root.first('[aria-label="Tank Duel"]')?.tagName).toBe('SECTION');
    // The row index and the trailing arrow are decoration, so the accessible name is the
    // label alone — "01 Quick Start →" is not what a screen reader should announce.
    expect(root.all('button').map((button) => button.getAttribute('aria-label') ?? button.textContent)).toEqual([
      'Quick Start',
      'How to Play',
      'Settings',
    ]);
    expect(root.all('button').some((button) => button.textContent.includes('Custom Game'))).toBe(false);
    expect(root.all('button')[0]?.textContent).toBe('01Quick Start→');
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
    const map = mapState();

    view.render(map);

    const random = root.all('button').find((button) => button.getAttribute('data-world-id') === 'random');
    // Mode is not switchable here any more: it is chosen on MODE, two screens back.
    expect(root.all('button').filter((button) => button.getAttribute('data-mode') !== null)).toHaveLength(0);
    expect(random?.textContent).toContain('Random');
    expect(random?.getAttribute('type')).toBe('button');
    root.click(random!);
    expect(onAction).toHaveBeenLastCalledWith({ type: 'selectMap', worldId: 'random' });
  });

  it('shows enabled CPU selection and labelled, locked HE controls with shell icons', () => {
    const root = createRoot();
    const view = mountAppView(root as unknown as HTMLElement, { onAction: vi.fn() });
    const title = createFlow(createDefaultConfig());

    view.render(modeState());
    const cpu = root.all('button').find((button) => button.getAttribute('data-mode') === 'cpu');
    expect(cpu?.disabled).toBe(false);
    expect(cpu?.textContent).not.toContain('Task 12');

    view.render(reduceFlow(title, { type: 'openCustom' }));
    const heToggle = root.first('[data-shell-toggle="he"]');
    const heCount = root.first('[data-shell-ammo="he"]');
    expect(heToggle?.tagName).toBe('INPUT');
    expect(heToggle?.disabled).toBe(true);
    expect(heCount?.disabled).toBe(true);
    expect(heCount?.value).toBe('∞');
    expect(root.first('[data-icon="/assets/icons/he.svg"]')?.tagName).toBe('SPAN');
    expect(root.all('label').some((label) => label.textContent.includes('HE Shell'))).toBe(true);
  });

  it('renders ordered CPU tier buttons with selected state and dispatches tier actions', () => {
    const root = createRoot();
    const onAction = vi.fn<(action: FlowAction) => void>();
    const view = mountAppView(root as unknown as HTMLElement, { onAction });
    const map = mapState();
    const cpuMap: AppFlowState = {
      ...map,
      config: { ...map.config, mode: 'cpu', cpuTierId: 'veteran' },
    };

    view.render(cpuMap);

    const tiers = root.all('button').filter((button) => button.getAttribute('data-cpu-tier') !== null);
    expect(tiers.map((button) => button.getAttribute('aria-label'))).toEqual(['Recruit', 'Gunner', 'Veteran']);
    // Each tier shows the median it was measured at, from spec/cpu.json.
    expect(tiers.map((button) => button.textContent)).toEqual([
      'Recruit5 shots',
      'Gunner3 shots',
      'Veteran2 shots',
    ]);
    expect(tiers.map((button) => button.getAttribute('type'))).toEqual(['button', 'button', 'button']);
    expect(tiers.map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true']);
    expect(tiers.every((button) => !button.disabled)).toBe(true);

    root.click(tiers[0]!);
    expect(onAction).toHaveBeenLastCalledWith({ type: 'selectCpuTier', cpuTierId: 'recruit' });
  });

  it('omits the CPU difficulty group entirely in local mode and styles it when shown', () => {
    const root = createRoot();
    const view = mountAppView(root as unknown as HTMLElement, { onAction: vi.fn() });
    const localMap = mapState();

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

    root.click(root.all('button').find((button) => button.getAttribute('aria-label') === 'Start match')!);
    expect(onAction).toHaveBeenLastCalledWith({ type: 'startCustom' });
  });

  it('renders icon-bearing ROUND_OVER shell summaries safely', () => {
    const root = createRoot();
    const view = mountAppView(root as unknown as HTMLElement, { onAction: vi.fn() });
    const config = createDefaultConfig();
    const title = createFlow(config);

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
    // Masked spans, not <img>: a `currentColor` SVG loaded as an image renders black and
    // vanishes on these panels.
    expect(root.all('img')).toHaveLength(0);
    expect(root.all('[data-icon]')).toHaveLength(1);
    expect(root.all('[data-icon]')[0]?.getAttribute('data-icon')).toBe('/assets/icons/mortar.svg');
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
