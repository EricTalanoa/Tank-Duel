import { SHELLS } from '../sim/shells';
import { validateConfig, type MatchConfig, type MatchRounds, type MatchTurnTimer, type MatchWind, type MatchWorldId } from './config';
import type { AppFlowState, FlowAction } from './flow';
import {
  buildCustomScreenModel,
  buildHowToScreenModel,
  buildMapScreenModel,
  buildModeScreenModel,
  buildRoundIntroScreenModel,
  buildRoundOverScreenModel,
  buildTitleScreenModel,
  type ActionButtonModel,
  type ShellSummaryModel,
} from './screenModels';
import './menu.css';

export interface AppViewCallbacks {
  readonly onAction: (action: FlowAction) => void;
  readonly onConfigChange?: (config: MatchConfig) => void;
}

export interface AppView {
  render(flowState: AppFlowState): void;
  dispose(): void;
}

export function mountAppView(root: HTMLElement, callbacks: AppViewCallbacks): AppView {
  const document = root.ownerDocument;
  let currentState: AppFlowState | null = null;
  let disposed = false;
  let nextActionId = 0;
  let actions = new Map<string, FlowAction>();

  const bindAction = (button: HTMLButtonElement, action: FlowAction): void => {
    const id = String(++nextActionId);
    actions.set(id, action);
    button.setAttribute('data-flow-action', id);
  };
  const onClick = (event: Event): void => {
    const control = closestElement(event.target, '[data-flow-action]');
    if (!control || !root.contains(control) || (control as HTMLButtonElement).disabled) return;
    const id = control.getAttribute('data-flow-action');
    const action = id === null ? undefined : actions.get(id);
    if (action) callbacks.onAction(action);
  };
  const onChange = (event: Event): void => {
    const control = closestElement(event.target, '[data-config-field], [data-shell-toggle], [data-shell-ammo]') as HTMLInputElement | HTMLSelectElement | null;
    if (!control || !root.contains(control) || control.disabled || !currentState) return;
    const field = control.getAttribute('data-config-field');
    if (field) {
      emitFieldConfig(currentState.config, field, control.value, callbacks.onConfigChange);
      return;
    }
    const toggleId = control.getAttribute('data-shell-toggle');
    if (toggleId) {
      emitShellConfig(currentState.config, toggleId, { enabled: (control as HTMLInputElement).checked }, callbacks.onConfigChange);
      return;
    }
    const ammoId = control.getAttribute('data-shell-ammo');
    if (ammoId) emitShellConfig(currentState.config, ammoId, { ammo: Number(control.value) }, callbacks.onConfigChange);
  };

  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  root.addEventListener('input', onChange);
  return {
    render(flowState: AppFlowState): void {
      if (disposed) return;
      currentState = flowState;
      nextActionId = 0;
      actions = new Map<string, FlowAction>();
      const surface = renderScreen(document, flowState, bindAction);
      root.replaceChildren(surface);
      focusScreenHeading(surface);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      currentState = null;
      actions.clear();
      root.removeEventListener('click', onClick);
      root.removeEventListener('change', onChange);
      root.removeEventListener('input', onChange);
      root.replaceChildren();
    },
  };
}

function renderScreen(document: Document, state: AppFlowState, bind: Binder): HTMLElement {
  switch (state.screen) {
    case 'TITLE': return renderTitle(document, bind);
    case 'MODE': return renderMode(document, state, bind);
    case 'MAP': return renderMap(document, state, bind);
    case 'CUSTOM': return renderCustom(document, state.config, bind);
    case 'ROUND_INTRO': return renderRoundIntro(document, state.config, bind);
    case 'HOWTO': return renderHowTo(document, bind);
    case 'ROUND_OVER': return renderRoundOver(document, state, bind);
    case 'LOADOUT': return screen(document, 'Choose loadout', 'LOADOUT');
    case 'MATCH': return screen(document, 'Match', 'MATCH');
  }
}

type Binder = (button: HTMLButtonElement, action: FlowAction) => void;

function renderTitle(document: Document, bind: Binder): HTMLElement {
  const model = buildTitleScreenModel();
  const surface = screen(document, model.label, model.id);
  surface.append(textElement(document, 'p', 'LOCAL ARTILLERY', 'menu-kicker'), textElement(document, 'h1', model.label));
  const nav = element(document, 'nav', 'menu-actions');
  nav.setAttribute('aria-label', 'Main menu');
  for (const button of model.buttons) nav.append(actionButton(document, button, bind));
  const corner = element(document, 'div', 'menu-corner');
  for (const label of model.corner) {
    const button = textElement(document, 'button', label, 'menu-corner-button') as HTMLButtonElement;
    button.type = 'button';
    button.disabled = true;
    corner.append(button);
  }
  surface.append(nav, corner);
  return surface;
}

function renderMode(document: Document, state: AppFlowState, bind: Binder): HTMLElement {
  const model = buildModeScreenModel(state);
  const surface = screen(document, model.label, model.id);
  surface.append(textElement(document, 'p', model.step, 'menu-step'), textElement(document, 'h1', model.label));
  const list = element(document, 'div', 'menu-grid');
  for (const option of model.options) list.append(actionButton(document, {
    label: option.label,
    action: option.action,
    disabled: option.disabled,
    ...(option.note === undefined ? {} : { note: option.note }),
  }, bind));
  surface.append(list);
  return surface;
}

function renderMap(document: Document, state: AppFlowState, bind: Binder): HTMLElement {
  const model = buildMapScreenModel(state);
  const surface = screen(document, model.label, model.id);
  surface.append(textElement(document, 'p', model.step, 'menu-step'), textElement(document, 'h1', model.label));
  const grid = element(document, 'div', 'map-grid');
  for (const tile of model.tiles) {
    const button = element(document, 'button', `map-tile${tile.selected ? ' is-selected' : ''}`) as HTMLButtonElement;
    button.setAttribute('type', 'button');
    button.setAttribute('data-world-id', tile.id);
    button.setAttribute('aria-pressed', String(tile.selected));
    button.append(textElement(document, 'strong', tile.name), textElement(document, 'small', tile.description));
    bind(button, tile.action);
    grid.append(button);
  }
  const modes = element(document, 'div', 'mode-summary');
  modes.setAttribute('aria-label', 'Mode');
  for (const option of model.modeOptions) {
    const button = element(document, 'button', 'mode-summary-option') as HTMLButtonElement;
    button.type = 'button';
    button.disabled = true;
    button.append(textElement(document, 'span', option.label));
    if (option.note) button.append(textElement(document, 'small', option.note));
    modes.append(button);
  }
  surface.append(modes, grid);
  return surface;
}

function renderCustom(document: Document, config: MatchConfig, bind: Binder): HTMLElement {
  const model = buildCustomScreenModel(config);
  const surface = screen(document, model.label, model.id);
  surface.append(textElement(document, 'h1', model.label));
  const form = element(document, 'div', 'custom-form');
  form.append(
    selectField(document, 'Rounds', 'rounds', model.roundOptions.map(String), String(model.rounds)),
    selectField(document, 'Wind', 'wind', model.windOptions, model.wind),
    selectField(document, 'Turn timer', 'turnTimer', model.turnTimerOptions, model.turnTimer),
    selectField(document, 'World', 'selectedWorldId', model.worldOptions.map((option) => option.id), model.worldId),
    selectField(document, 'Terrain', 'selectedGeneratorId', ['default', ...model.generatorOptions], model.generatorId ?? 'default'),
    inputField(document, 'Seed', 'seed', String(model.seed)),
  );
  const ammunition = element(document, 'fieldset', 'ammunition-list');
  ammunition.append(textElement(document, 'legend', 'Ammunition'));
  for (const row of model.shells) {
    const shellRow = element(document, 'div', 'ammunition-row');
    const toggleLabel = element(document, 'label', 'shell-toggle');
    const toggle = document.createElement('input');
    toggle.setAttribute('type', 'checkbox');
    toggle.checked = row.enabled;
    toggle.disabled = row.toggleDisabled;
    toggle.setAttribute('data-shell-toggle', row.id);
    toggleLabel.append(toggle, shellIcon(document, row.icon), textElement(document, 'span', row.name));
    const countLabel = element(document, 'label', 'shell-count');
    countLabel.append(textElement(document, 'span', 'Ammo'));
    const count = document.createElement('input');
    count.setAttribute('type', row.ammo === 'inf' ? 'text' : 'number');
    count.value = row.ammoLabel;
    count.disabled = row.countDisabled;
    count.setAttribute('data-shell-ammo', row.id);
    if (row.ammo !== 'inf') {
      count.setAttribute('min', String(model.ammoBounds.min));
      count.setAttribute('max', String(model.ammoBounds.max));
    }
    countLabel.append(count);
    shellRow.append(toggleLabel, countLabel);
    ammunition.append(shellRow);
  }
  form.append(ammunition);
  surface.append(form, actionButton(document, { label: 'Start match', action: model.startAction, disabled: false }, bind));
  return surface;
}

function renderRoundIntro(document: Document, config: MatchConfig, bind: Binder): HTMLElement {
  const model = buildRoundIntroScreenModel(config);
  const surface = screen(document, model.label, model.id);
  surface.append(textElement(document, 'h1', model.label));
  const summary = element(document, 'dl', 'match-summary');
  appendTerm(document, summary, 'World', model.worldName);
  appendTerm(document, summary, 'Terrain', model.generatorName);
  appendTerm(document, summary, 'Rounds', String(model.rounds));
  appendTerm(document, summary, 'Wind', model.wind);
  appendTerm(document, summary, 'Turn timer', model.turnTimer);
  surface.append(summary, shellSummaryList(document, model.shells));
  surface.append(actionButton(document, { label: 'Choose loadout', action: model.action, disabled: false }, bind));
  return surface;
}

function renderHowTo(document: Document, bind: Binder): HTMLElement {
  const model = buildHowToScreenModel();
  const surface = screen(document, model.label, model.id);
  surface.append(textElement(document, 'h1', model.label), textElement(document, 'p', 'Bracket the target: observe, correct, then fire between your last two shots.'));
  const list = element(document, 'ol', 'howto-shots');
  for (const shot of model.shots) list.append(textElement(document, 'li', `${shot.result.toUpperCase()} · power ${shot.power}`));
  const actions = element(document, 'div', 'menu-actions');
  actions.append(
    actionButton(document, { label: 'Back', action: model.backAction, disabled: false }, bind),
    actionButton(document, { label: 'Play', action: model.playAction, disabled: false }, bind),
  );
  surface.append(list, actions);
  return surface;
}

function renderRoundOver(document: Document, state: AppFlowState, bind: Binder): HTMLElement {
  const model = buildRoundOverScreenModel(state);
  const surface = screen(document, model.label, model.id);
  surface.append(textElement(document, 'h1', model.label));
  for (const player of model.players) {
    const recap = element(document, 'section', 'player-recap');
    recap.setAttribute('aria-label', player.label);
    recap.append(textElement(document, 'h2', player.label), shellSummaryList(document, player.shells));
    surface.append(recap);
  }
  const actions = element(document, 'div', 'menu-actions');
  for (const button of model.buttons) actions.append(actionButton(document, button, bind));
  surface.append(actions);
  return surface;
}

function screen(document: Document, label: string, id: string): HTMLElement {
  const surface = element(document, 'section', 'app-screen');
  surface.setAttribute('aria-label', label);
  surface.setAttribute('data-screen', id);
  return surface;
}

function actionButton(document: Document, model: ActionButtonModel, bind: Binder): HTMLButtonElement {
  const button = element(document, 'button', 'menu-button') as HTMLButtonElement;
  button.setAttribute('type', 'button');
  button.disabled = model.disabled;
  button.append(textElement(document, 'span', model.label));
  if (model.note) button.append(textElement(document, 'small', model.note));
  bind(button, model.action);
  return button;
}

function selectField(document: Document, labelText: string, field: string, values: readonly string[], selected: string): HTMLElement {
  const label = element(document, 'label', 'form-field');
  label.append(textElement(document, 'span', labelText));
  const select = document.createElement('select');
  select.setAttribute('data-config-field', field);
  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = displayOption(value);
    option.selected = value === selected;
    select.append(option);
  }
  select.value = selected;
  label.append(select);
  return label;
}

function inputField(document: Document, labelText: string, field: string, value: string): HTMLElement {
  const label = element(document, 'label', 'form-field');
  label.append(textElement(document, 'span', labelText));
  const input = document.createElement('input');
  input.setAttribute('type', 'number');
  input.value = value;
  input.setAttribute('data-config-field', field);
  label.append(input);
  return label;
}

function shellSummaryList(document: Document, shells: readonly Pick<ShellSummaryModel, 'id' | 'name' | 'icon'>[]): HTMLElement {
  const list = element(document, 'ul', 'shell-summary');
  for (const shell of shells) {
    const item = element(document, 'li');
    item.setAttribute('data-shell-id', shell.id);
    item.append(shellIcon(document, shell.icon), textElement(document, 'span', shell.name));
    list.append(item);
  }
  return list;
}

function shellIcon(document: Document, path: string): HTMLImageElement {
  const image = document.createElement('img');
  image.className = 'shell-icon';
  image.setAttribute('src', `/${path}`);
  image.setAttribute('alt', '');
  image.setAttribute('aria-hidden', 'true');
  return image;
}

function appendTerm(document: Document, list: HTMLElement, term: string, value: string): void {
  list.append(textElement(document, 'dt', term), textElement(document, 'dd', value));
}

function emitFieldConfig(config: MatchConfig, field: string, value: string, callback: AppViewCallbacks['onConfigChange']): void {
  let patch: Partial<MatchConfig>;
  switch (field) {
    case 'rounds': patch = { rounds: Number(value) as MatchRounds }; break;
    case 'wind': patch = { wind: value as MatchWind }; break;
    case 'turnTimer': patch = { turnTimer: value as MatchTurnTimer }; break;
    case 'selectedWorldId': patch = { selectedWorldId: value as MatchWorldId, selectedGeneratorId: null }; break;
    case 'selectedGeneratorId': patch = { selectedGeneratorId: value === 'default' ? null : value as MatchConfig['selectedGeneratorId'] }; break;
    case 'seed': patch = { seed: Number(value) }; break;
    default: return;
  }
  emitValidConfig({ ...config, ...patch }, callback);
}

function emitShellConfig(config: MatchConfig, id: string, patch: Readonly<{ enabled?: boolean; ammo?: number }>, callback: AppViewCallbacks['onConfigChange']): void {
  const current = config.shells[id];
  if (!current || current.locked) return;
  const shells = { ...config.shells, [id]: { ...current, ...patch } };
  const enabledShellIds = SHELLS.filter((shell) => shells[shell.id]?.enabled).map((shell) => shell.id);
  emitValidConfig({ ...config, shells, enabledShellIds }, callback);
}

function emitValidConfig(value: unknown, callback: AppViewCallbacks['onConfigChange']): void {
  const config = validateConfig(value);
  if (config) callback?.(config);
}

function displayOption(value: string): string {
  return value === 'default' ? 'Default' : value.charAt(0).toUpperCase() + value.slice(1);
}

function focusScreenHeading(surface: HTMLElement): void {
  const heading = surface.querySelector<HTMLElement>('h1');
  if (!heading) return;
  heading.setAttribute('tabindex', '-1');
  heading.focus();
}

function closestElement(target: EventTarget | null, selector: string): Element | null {
  if (!target || typeof (target as Element).closest !== 'function') return null;
  return (target as Element).closest(selector);
}

function element(document: Document, tagName: string, className = ''): HTMLElement {
  const node = document.createElement(tagName);
  node.className = className;
  return node;
}

function textElement(document: Document, tagName: string, text: string, className = ''): HTMLElement {
  const node = element(document, tagName, className);
  node.textContent = text;
  return node;
}
