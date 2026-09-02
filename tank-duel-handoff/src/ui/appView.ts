import { SHELLS } from '../sim/shells';
import { generateHeightmap } from '../sim/generators';
import { createRng, hashSeed } from '../sim/rng';
import { CONSTANTS } from '../sim/constants';
import { drawTankSilhouette } from '../render/entities';
import {
  validateConfig,
  withCrewColor,
  withCrewName,
  type MatchConfig,
  type MatchRounds,
  type MatchTurnTimer,
  type MatchWind,
  type MatchWorldId,
} from './config';
import type { AppFlowState, FlowAction } from './flow';
import {
  buildCrewScreenModel,
  buildCustomScreenModel,
  buildHowToScreenModel,
  buildMapScreenModel,
  buildModeScreenModel,
  buildRoundIntroScreenModel,
  buildRoundOverScreenModel,
  buildTitleScreenModel,
  type ActionButtonModel,
  type CpuTierOptionModel,
  type CrewPanelModel,
  type MapTileModel,
  type ModeOptionModel,
  type RoundOverShellModel,
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
    const control = closestElement(event.target, '[data-flow-action], [data-crew-color]');
    if (!control || !root.contains(control) || (control as HTMLButtonElement).disabled) return;

    // A swatch changes configuration rather than navigating, so it is the one control that
    // goes to `onConfigChange` from a click rather than from `change`.
    const color = control.getAttribute('data-crew-color');
    if (color !== null && currentState) {
      emitValidConfig(
        withCrewColor(currentState.config, crewPlayer(control), color),
        callbacks.onConfigChange,
      );
      return;
    }
    const id = control.getAttribute('data-flow-action');
    const action = id === null ? undefined : actions.get(id);
    if (action) callbacks.onAction(action);
  };
  const onChange = (event: Event): void => {
    const control = closestElement(event.target, '[data-config-field], [data-crew-name], [data-shell-toggle], [data-shell-ammo]') as HTMLInputElement | HTMLSelectElement | null;
    if (!control || !root.contains(control) || control.disabled || !currentState) return;
    const field = control.getAttribute('data-config-field');
    if (field) {
      emitFieldConfig(currentState.config, field, control.value, callbacks.onConfigChange);
      return;
    }
    if (control.getAttribute('data-crew-name') !== null) {
      emitValidConfig(
        withCrewName(currentState.config, crewPlayer(control), control.value),
        callbacks.onConfigChange,
      );
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
      const focus = captureFieldFocus(document, root);
      const surface = renderScreen(document, flowState, bindAction);
      root.replaceChildren(surface);
      paintTileSilhouettes(surface, crewColors(flowState.config));
      paintCrewPreviews(surface);
      // A render the player caused by typing must not take the caret away, nor re-announce
      // a screen they never left.
      if (!restoreFieldFocus(surface, focus)) focusScreenHeading(surface);
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
    case 'CREW': return renderCrew(document, state, bind);
    case 'MAP': return renderMap(document, state, bind);
    case 'CUSTOM': return renderCustom(document, state, bind);
    case 'ROUND_INTRO': return renderRoundIntro(document, state.config, bind);
    case 'HOWTO': return renderHowTo(document, bind);
    case 'ROUND_OVER': return renderRoundOver(document, state, bind);
    case 'LOADOUT': return screen(document, 'Choose loadout', 'LOADOUT');
    case 'MATCH': return screen(document, 'Match', 'MATCH');
  }
}

type Binder = (button: HTMLButtonElement, action: FlowAction) => void;

/** 01 — canvas scene behind, wordmark and menu bottom-left, settings top-right. */
function renderTitle(document: Document, bind: Binder): HTMLElement {
  const model = buildTitleScreenModel();
  const surface = screen(document, model.label, model.id);

  const column = element(document, 'div', 'title-column');
  const intro = element(document, 'div', 'title-intro');
  intro.append(
    textElement(document, 'p', model.kicker, 'menu-kicker'),
    lines(document, 'h1', model.wordmark, 'title-wordmark'),
    element(document, 'hr', 'rule'),
    lines(document, 'p', model.blurb, 'title-blurb'),
  );

  const nav = element(document, 'nav', 'title-menu');
  nav.setAttribute('aria-label', 'Main menu');
  model.buttons.forEach((button, index) => nav.append(titleRow(document, button, index, bind)));
  column.append(intro, nav);

  const corner = element(document, 'div', 'menu-corner');
  for (const label of model.corner) {
    const button = textElement(document, 'button', label, 'menu-corner-button') as HTMLButtonElement;
    button.type = 'button';
    button.disabled = true;
    corner.append(button);
  }
  surface.append(column, corner);
  return surface;
}

/**
 * The index and the mark are decoration around the label, so the accessible name is the
 * label alone rather than "01 Quick Start →".
 */
function titleRow(
  document: Document,
  model: ActionButtonModel,
  index: number,
  bind: Binder,
): HTMLButtonElement {
  const button = element(document, 'button', 'title-row') as HTMLButtonElement;
  button.type = 'button';
  button.disabled = model.disabled;
  button.setAttribute('aria-label', model.label);
  button.append(
    textElement(document, 'span', String(index + 1).padStart(2, '0'), 'menu-index'),
    textElement(document, 'span', model.label, 'menu-label'),
    mark(document),
  );
  bind(button, model.action);
  return button;
}

/** 02 — two cards; the CPU card carries the difficulty tiers below its description. */
function renderMode(document: Document, state: AppFlowState, bind: Binder): HTMLElement {
  const model = buildModeScreenModel(state);
  const surface = screen(document, model.label, model.id);
  surface.append(header(document, {
    kicker: 'Quick start',
    step: `Step ${model.step.replace(' / ', ' / 0').replace(/^(\d)/, '0$1')}`,
    title: [model.label],
  }));

  const body = element(document, 'div', 'screen-body mode-grid');
  for (const option of model.options) {
    body.append(modeCard(document, option, state.config.mode, model.cpuTiers, bind));
  }
  surface.append(body, footer(document, 'Choose a mode', [
    secondaryButton(document, { label: 'Back', action: { type: 'back' }, disabled: false }, bind),
  ]));
  return surface;
}

function modeCard(
  document: Document,
  option: ModeOptionModel,
  mode: MatchConfig['mode'],
  tiers: readonly CpuTierOptionModel[],
  bind: Binder,
): HTMLButtonElement {
  const card = element(document, 'button', `mode-card${option.selected ? ' is-selected' : ''}`) as HTMLButtonElement;
  card.type = 'button';
  card.disabled = option.disabled;
  card.setAttribute('data-mode', option.id);
  card.setAttribute('aria-pressed', String(option.selected));

  const top = element(document, 'div', 'mode-card-top');
  top.append(
    textElement(document, 'span', option.selected ? 'Selected' : cardState(option, mode), 'mode-card-state'),
    element(document, 'span', 'mode-card-marker'),
  );
  const body = element(document, 'div', 'mode-card-body');
  body.append(textElement(document, 'span', option.label, 'mode-card-title'));
  if (option.note) body.append(textElement(document, 'span', option.note, 'mode-card-note'));
  card.append(top, body);
  if (option.id === 'cpu') card.append(cpuTierTiles(document, tiers));
  bind(card, option.action);
  return card;
}

function cardState(option: ModeOptionModel, mode: MatchConfig['mode']): string {
  return option.id === 'cpu' && mode === 'cpu' ? 'Difficulty below' : 'Select';
}

/** Read-only tiles inside the CPU card: the medians come from `spec/cpu.json`. */
function cpuTierTiles(document: Document, tiers: readonly CpuTierOptionModel[]): HTMLElement {
  const grid = element(document, 'div', 'cpu-tier-grid');
  for (const tier of tiers) {
    const tile = element(document, 'div', 'cpu-tier-option');
    tile.append(
      textElement(document, 'span', tier.label),
      textElement(document, 'small', tier.note),
    );
    grid.append(tile);
  }
  return grid;
}

/** 02b — one panel per crew: a name, a colour, and the tank that colour is going on. */
function renderCrew(document: Document, state: AppFlowState, bind: Binder): HTMLElement {
  const model = buildCrewScreenModel(state);
  const surface = screen(document, model.label, model.id);

  surface.append(header(document, {
    kicker: model.kicker,
    step: model.step,
    title: [model.label],
  }));

  const body = element(document, 'div', 'screen-body crew-panels');
  for (const crew of model.crews) body.append(crewPanel(document, crew));

  surface.append(body, footer(document, model.status, [
    secondaryButton(document, { label: 'Back', action: model.backAction, disabled: false }, bind),
    primaryButton(document, {
      label: 'Continue',
      action: model.continueAction,
      disabled: !model.ready,
    }, bind),
  ]));
  return surface;
}

/** Named and coloured here only: nothing on this panel navigates, so it takes no binder. */
function crewPanel(document: Document, crew: CrewPanelModel): HTMLElement {
  const panel = element(document, 'section', 'crew-panel');
  panel.setAttribute('aria-label', crew.label);
  panel.setAttribute('data-player', String(crew.player));

  const head = element(document, 'header');
  const identity = element(document, 'div', 'crew-identity');
  const tag = textElement(document, 'span', crew.tag, 'player-tag');
  tag.setAttribute('style', `--player-color: ${crew.color}`);
  identity.append(tag, textElement(document, 'span', crew.label, 'panel-label'));
  head.append(identity, textElement(document, 'span', crew.colorLabel, 'crew-hex'));

  const preview = element(document, 'canvas', 'crew-preview') as HTMLCanvasElement;
  preview.setAttribute('aria-hidden', 'true');
  preview.setAttribute('data-crew-preview', String(crew.player));
  preview.setAttribute('data-crew-preview-color', crew.color);
  preview.setAttribute('data-crew-preview-angle', String(crew.previewAngleDeg));
  preview.setAttribute('data-crew-preview-direction', String(crew.previewDirection));

  const nameField = element(document, 'label', 'form-field crew-name');
  nameField.append(textElement(document, 'span', 'Crew name'));
  const input = document.createElement('input');
  input.setAttribute('type', 'text');
  input.setAttribute('maxlength', String(crew.nameMaxLength));
  input.setAttribute('placeholder', crew.placeholder);
  input.setAttribute('data-crew-name', String(crew.player));
  input.value = crew.name;
  input.disabled = crew.nameDisabled;
  nameField.append(input);

  const colorField = element(document, 'div', 'form-field crew-colour');
  colorField.append(textElement(document, 'span', 'Tank colour'));
  const swatches = element(document, 'div', 'crew-swatches');
  swatches.setAttribute('role', 'group');
  swatches.setAttribute('aria-label', crew.swatchGroupLabel);
  for (const swatch of crew.swatches) {
    const button = element(document, 'button', `crew-swatch${swatch.selected ? ' is-selected' : ''}`) as HTMLButtonElement;
    button.setAttribute('type', 'button');
    button.setAttribute('aria-label', swatch.label);
    button.setAttribute('aria-pressed', String(swatch.selected));
    button.setAttribute('data-crew-color', swatch.value);
    button.setAttribute('data-crew-player', String(crew.player));
    const chip = element(document, 'span', 'crew-swatch-chip');
    chip.setAttribute('aria-hidden', 'true');
    chip.setAttribute('style', `background: ${swatch.value}`);
    button.append(chip);
    swatches.append(button);
  }
  colorField.append(swatches);

  panel.append(head, preview, nameField, colorField);
  return panel;
}

/** 03 — seven tiles, each with a terrain silhouette and the figures being chosen between. */
function renderMap(document: Document, state: AppFlowState, bind: Binder): HTMLElement {
  const model = buildMapScreenModel(state);
  const surface = screen(document, model.label, model.id);

  const modes = element(document, 'div', 'mode-summary');
  modes.setAttribute('aria-label', 'Mode');
  for (const option of model.modeOptions) modes.append(modeOptionButton(document, option, bind));

  surface.append(header(document, {
    kicker: `Quick start · ${selectedModeLabel(model.modeOptions)}`,
    step: 'Step 02 / 02',
    title: [model.label],
    aside: modes,
  }));

  const body = element(document, 'div', 'screen-body map-grid');
  for (const tile of model.tiles) body.append(mapTile(document, tile, bind));
  surface.append(...cpuTierControls(document, state.config.mode, model.cpuTiers, bind), body);
  surface.append(footer(document, mapStatus(model.tiles), [
    secondaryButton(document, { label: 'Back', action: { type: 'back' }, disabled: false }, bind),
    primaryButton(document, { label: 'Deploy', action: deployAction(model.tiles), disabled: false }, bind),
  ]));
  return surface;
}

function mapTile(document: Document, tile: MapTileModel, bind: Binder): HTMLButtonElement {
  const classes = ['map-tile'];
  if (tile.random) classes.push('is-random');
  if (tile.selected) classes.push('is-selected');
  const button = element(document, 'button', classes.join(' ')) as HTMLButtonElement;
  button.setAttribute('type', 'button');
  button.setAttribute('data-world-id', tile.id);
  button.setAttribute('aria-pressed', String(tile.selected));

  const canvas = element(document, 'canvas', 'tile-canvas') as HTMLCanvasElement;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('data-tile-generator', tile.generator ?? '');
  canvas.setAttribute('data-tile-field-width', String(tile.fieldWidth));
  if (tile.accent) canvas.setAttribute('data-tile-accent', tile.accent);

  const heading = element(document, 'div', 'tile-heading');
  heading.append(
    textElement(document, 'strong', tile.name, 'tile-name'),
    textElement(document, 'small', tile.description, 'tile-kind'),
  );

  const stats = element(document, 'div', 'tile-stats');
  stats.append(
    textElement(document, 'span', tile.gravity),
    textElement(document, 'span', tile.width),
    textElement(document, 'span', tile.wind),
  );

  button.append(canvas, heading, stats);
  bind(button, tile.action);
  return button;
}

function mapStatus(tiles: readonly MapTileModel[]): string {
  const selected = tiles.find((tile) => tile.selected);
  if (!selected) return 'Select a battlefield';
  return selected.random
    ? 'Random selected · seed rolls at deploy'
    : `${selected.name} selected · ${selected.gravity} · ${selected.wind}`;
}

/** Deploy re-selects the current tile, which is what advances the flow. */
function deployAction(tiles: readonly MapTileModel[]): FlowAction {
  const selected = tiles.find((tile) => tile.selected) ?? tiles[0];
  return selected?.action ?? { type: 'back' };
}

/** 04 — settings on one row, ammunition in two columns, no scroll inside 834px. */
function renderCustom(document: Document, state: AppFlowState, bind: Binder): HTMLElement {
  const model = buildCustomScreenModel(state);
  const surface = screen(document, model.label, model.id);

  const modes = element(document, 'div', 'mode-summary');
  modes.setAttribute('aria-label', 'Mode');
  for (const option of model.modeOptions) modes.append(modeOptionButton(document, option, bind));
  surface.append(header(document, { kicker: 'Custom game', title: [], aside: modes }));

  const fields = element(document, 'div', 'custom-fields');
  fields.append(
    selectField(document, 'Rounds', 'rounds', model.roundOptions.map(String), String(model.rounds)),
    selectField(document, 'Wind', 'wind', model.windOptions, model.wind),
    selectField(document, 'Turn timer', 'turnTimer', model.turnTimerOptions, model.turnTimer),
    selectField(document, 'World', 'selectedWorldId', model.worldOptions.map((option) => option.id), model.worldId),
    selectField(document, 'Terrain', 'selectedGeneratorId', ['default', ...model.generatorOptions], model.generatorId ?? 'default'),
    inputField(document, 'Seed', 'seed', String(model.seed)),
  );

  const ammunition = element(document, 'section', 'screen-body ammunition-list');
  ammunition.setAttribute('aria-label', 'Ammunition');
  const head = element(document, 'div', 'section-head');
  head.append(
    textElement(document, 'span', model.ammunitionLabel, 'section-label'),
    textElement(document, 'span', 'HE is locked on and unlimited', 'section-note'),
  );
  const rows = element(document, 'div', 'ammunition-rows');
  for (const row of model.shells) {
    const shellRow = element(document, 'div', `ammunition-row${row.enabled ? '' : ' is-off'}`);

    // The 16px box is decoration; the label is the hit target and carries the name.
    const toggleLabel = element(document, 'label', 'shell-toggle');
    const toggle = document.createElement('input');
    toggle.setAttribute('type', 'checkbox');
    toggle.checked = row.enabled;
    toggle.disabled = row.toggleDisabled;
    toggle.setAttribute('data-shell-toggle', row.id);
    toggleLabel.append(
      toggle,
      element(document, 'span', 'shell-toggle-box'),
      shellIcon(document, row.icon),
      textElement(document, 'span', row.name, 'shell-toggle-name'),
    );

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

    shellRow.append(toggleLabel, textElement(document, 'span', row.costLabel, 'shell-cost'), countLabel);
    rows.append(shellRow);
  }
  ammunition.append(head, rows);

  surface.append(
    fields,
    ...cpuTierControls(document, state.config.mode, model.cpuTiers, bind),
    ammunition,
    footer(document, model.summary, [
      secondaryButton(document, { label: 'Back', action: { type: 'back' }, disabled: false }, bind),
      primaryButton(document, { label: 'Start match', action: model.startAction, disabled: false }, bind),
    ]),
  );
  return surface;
}

/** 06 — briefing on the left, the shells actually in play on the right. */
function renderRoundIntro(document: Document, config: MatchConfig, bind: Binder): HTMLElement {
  const model = buildRoundIntroScreenModel(config);
  const surface = screen(document, model.label, model.id);

  const main = element(document, 'div', 'intro-main');
  const summary = element(document, 'dl', 'match-summary');
  for (const entry of model.briefing) appendTerm(document, summary, entry.term, entry.value);
  const deploy = primaryButton(document, { label: 'Choose loadout', action: model.action, disabled: false }, bind);
  deploy.className = 'menu-button is-wide';
  main.append(header(document, { kicker: 'Briefing', title: [model.label] }), summary, deploy);

  const panel = element(document, 'section', 'shell-panel');
  panel.setAttribute('aria-label', 'Shells in play');
  panel.append(
    textElement(document, 'span', 'Shells in play', 'section-label'),
    shellSummaryList(document, model.shells),
  );

  surface.append(main, panel, footer(document, 'Review match settings', [
    secondaryButton(document, { label: 'Back', action: { type: 'back' }, disabled: false }, bind),
  ]));
  return surface;
}

/** 05 — canvas scene behind; three shot cards over the arcs they describe. */
function renderHowTo(document: Document, bind: Binder): HTMLElement {
  const model = buildHowToScreenModel();
  const surface = screen(document, model.label, model.id);

  const head = header(document, { kicker: 'How to play', title: model.headline });
  head.append(lines(document, 'p', model.lede, 'howto-lede'));
  surface.append(head, element(document, 'div', 'screen-body'));

  const cards = element(document, 'ol', 'howto-shots');
  for (const shot of model.shots) {
    const card = element(document, 'li');
    card.setAttribute('style', `--shot-accent: ${shot.accent}`);
    card.append(
      textElement(document, 'span', shot.step, 'howto-step'),
      textElement(document, 'strong', shot.result, 'howto-result'),
      textElement(document, 'span', `Power ${shot.power}`, 'howto-power'),
    );
    cards.append(card);
  }

  const foot = element(document, 'footer', 'screen-footer');
  const actions = element(document, 'div', 'footer-actions');
  actions.append(
    secondaryButton(document, { label: 'Back', action: model.backAction, disabled: false }, bind),
    primaryButton(document, { label: 'Play', action: model.playAction, disabled: false }, bind),
  );
  foot.append(cards, actions);
  surface.append(foot);
  return surface;
}

/** 09 — the outcome at 68px, then a recap panel per player with shell counts. */
function renderRoundOver(document: Document, state: AppFlowState, bind: Binder): HTMLElement {
  const model = buildRoundOverScreenModel(state);
  const surface = screen(document, model.label, model.id);

  const heading = element(document, 'h1', 'screen-title');
  for (const line of model.headline) {
    const row = element(document, 'span');
    for (const span of line) {
      const piece = textElement(document, 'span', span.text);
      piece.className = '';
      if (span.accent && model.accentColor) piece.setAttribute('style', `color: ${model.accentColor}`);
      row.append(piece);
    }
    heading.append(row);
  }
  const head = element(document, 'header', 'screen-header');
  head.append(
    textElement(document, 'p', model.kicker, 'menu-kicker'),
    heading,
    element(document, 'hr', 'rule'),
  );

  const body = element(document, 'div', 'screen-body recap-grid');
  for (const player of model.players) {
    const recap = element(document, 'section', 'player-recap');
    recap.setAttribute('aria-label', player.label);
    if (player.winner) recap.setAttribute('style', `border-color: ${player.color}66`);

    const recapHead = element(document, 'div', 'recap-head');
    const identity = element(document, 'div', 'recap-identity');
    const tag = textElement(document, 'span', player.tag, 'player-tag');
    tag.setAttribute('style', `--player-color: ${player.color}`);
    identity.append(tag, textElement(document, 'h2', player.label));
    recapHead.append(identity, textElement(document, 'span', player.summary, 'recap-summary'));

    recap.append(recapHead, spentShellList(document, player.shells));
    body.append(recap);
  }

  const actions = model.buttons.map((button, index) => (index === model.buttons.length - 1
    ? primaryButton(document, button, bind)
    : secondaryButton(document, button, bind)));
  const foot = element(document, 'footer', 'screen-footer');
  foot.append(textElement(document, 'p', 'Round complete', 'footer-status'), ...actions);

  surface.append(head, body, foot);
  return surface;
}

/* ── Shared chrome ──────────────────────────────────────────────────────────────── */

interface HeaderOptions {
  readonly kicker: string;
  readonly step?: string;
  /** Title lines. Empty renders the kicker row and rule alone, as Custom does. */
  readonly title: readonly string[];
  /** Replaces the step slot on the right of the kicker row. */
  readonly aside?: HTMLElement;
}

function header(document: Document, options: HeaderOptions): HTMLElement {
  const head = element(document, 'header', 'screen-header');
  const row = element(document, 'div', 'header-row');
  row.append(textElement(document, 'p', options.kicker, 'menu-kicker'));
  if (options.aside) row.append(options.aside);
  else if (options.step) row.append(textElement(document, 'p', options.step, 'menu-step'));
  head.append(row);
  if (options.title.length > 0) head.append(lines(document, 'h1', options.title, 'screen-title'));
  head.append(element(document, 'hr', 'rule'));
  return head;
}

function footer(document: Document, status: string, actions: readonly HTMLElement[]): HTMLElement {
  const foot = element(document, 'footer', 'screen-footer');
  foot.append(textElement(document, 'p', status, 'footer-status'));
  if (actions.length > 0) {
    const group = element(document, 'div', 'footer-actions');
    group.append(...actions);
    foot.append(group);
  }
  return foot;
}

function screen(document: Document, label: string, id: string): HTMLElement {
  const surface = element(document, 'section', 'app-screen');
  surface.setAttribute('aria-label', label);
  surface.setAttribute('data-screen', id);
  return surface;
}

/** The trailing arrow is decoration, so it stays out of the accessible name. */
function primaryButton(document: Document, model: ActionButtonModel, bind: Binder): HTMLButtonElement {
  return actionButton(document, model, bind, 'menu-button', true);
}

function secondaryButton(document: Document, model: ActionButtonModel, bind: Binder): HTMLButtonElement {
  return actionButton(document, model, bind, 'menu-button is-secondary', false);
}

function actionButton(
  document: Document,
  model: ActionButtonModel,
  bind: Binder,
  className: string,
  arrow: boolean,
): HTMLButtonElement {
  const button = element(document, 'button', className) as HTMLButtonElement;
  button.setAttribute('type', 'button');
  button.setAttribute('aria-label', model.label);
  button.disabled = model.disabled;
  button.append(textElement(document, 'span', model.label));
  if (arrow) button.append(mark(document));
  if (model.note) button.append(textElement(document, 'small', model.note));
  bind(button, model.action);
  return button;
}

function mark(document: Document): HTMLElement {
  const span = textElement(document, 'span', '→', 'menu-mark');
  span.setAttribute('aria-hidden', 'true');
  return span;
}

function modeOptionButton(document: Document, option: ModeOptionModel, bind: Binder): HTMLButtonElement {
  const button = element(document, 'button', `mode-summary-option${option.selected ? ' is-selected' : ''}`) as HTMLButtonElement;
  button.setAttribute('type', 'button');
  button.disabled = option.disabled;
  button.setAttribute('data-mode', option.id);
  button.setAttribute('aria-pressed', String(option.selected));
  button.append(textElement(document, 'span', option.label));
  if (option.note) button.append(textElement(document, 'small', option.note));
  bind(button, option.action);
  return button;
}

function selectedModeLabel(options: readonly ModeOptionModel[]): string {
  return options.find((option) => option.selected)?.label ?? '';
}

/**
 * Only CPU mode has a difficulty to choose. Rendering the group in local mode would put three
 * permanently disabled buttons on every menu screen, which reads as broken rather than inactive.
 */
function cpuTierControls(
  document: Document,
  mode: MatchConfig['mode'],
  tiers: readonly CpuTierOptionModel[],
  bind: Binder,
): readonly HTMLElement[] {
  if (mode !== 'cpu') return [];
  const fieldset = element(document, 'fieldset', 'cpu-tier-controls');
  fieldset.append(textElement(document, 'legend', 'CPU difficulty'));
  const options = element(document, 'div', 'cpu-tier-grid');
  for (const tier of tiers) {
    const button = element(document, 'button', `cpu-tier-option${tier.selected ? ' is-selected' : ''}`) as HTMLButtonElement;
    button.setAttribute('type', 'button');
    button.disabled = tier.disabled;
    button.setAttribute('data-cpu-tier', tier.id);
    button.setAttribute('aria-pressed', String(tier.selected));
    button.setAttribute('aria-label', tier.label);
    button.append(
      textElement(document, 'span', tier.label),
      textElement(document, 'small', tier.note),
    );
    bind(button, tier.action);
    options.append(button);
  }
  fieldset.append(options);
  return [fieldset];
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

function shellSummaryList(document: Document, shells: readonly ShellSummaryModel[]): HTMLElement {
  const list = element(document, 'ul', 'shell-summary');
  for (const shell of shells) {
    const item = element(document, 'li');
    item.setAttribute('data-shell-id', shell.id);
    item.append(
      shellIcon(document, shell.icon),
      textElement(document, 'span', shell.name),
      textElement(document, 'span', `${shell.ammoLabel} ammo`, 'shell-ammo'),
    );
    list.append(item);
  }
  return list;
}

function spentShellList(document: Document, shells: readonly RoundOverShellModel[]): HTMLElement {
  const list = element(document, 'ul', 'shell-summary');
  for (const shell of shells) {
    const item = element(document, 'li');
    item.setAttribute('data-shell-id', shell.id);
    item.append(
      shellIcon(document, shell.icon),
      textElement(document, 'span', shell.name),
      textElement(document, 'span', `×${shell.count}`, 'shell-ammo'),
    );
    list.append(item);
  }
  return list;
}

/**
 * A masked span, not an `<img>`. The icons are `fill="none" stroke="currentColor"`, and an
 * SVG loaded as an image gets no inheritable colour — `currentColor` resolves to black and
 * the icon disappears on a dark panel. Masking makes one file cover every state.
 */
function shellIcon(document: Document, path: string): HTMLElement {
  const icon = element(document, 'span', 'shell-icon');
  icon.setAttribute('data-icon', `/${path}`);
  icon.setAttribute('style', `--icon: url("/${path}")`);
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}

/** One `<span>` per line; the stylesheet makes them block so they break where intended. */
function lines(
  document: Document,
  tagName: string,
  values: readonly string[],
  className: string,
): HTMLElement {
  const node = element(document, tagName, className);
  for (const value of values) node.append(textElement(document, 'span', value));
  return node;
}

function appendTerm(document: Document, list: HTMLElement, term: string, value: string): void {
  const row = element(document, 'div');
  row.append(textElement(document, 'dt', term), textElement(document, 'dd', value));
  list.append(row);
}

/**
 * Draws each battlefield tile's terrain from its own generator at a fixed preview seed, so
 * the tile shows the shape of the ground rather than only its name.
 *
 * Runs after mount because it needs the canvas' laid-out width. Silently does nothing
 * without a 2D context, which is the headless case.
 */
const TILE_PREVIEW_SEED = hashSeed('tank-duel:map-preview');
const TILE_PREVIEW = { width: 246, height: 76 } as const;

function paintTileSilhouettes(surface: HTMLElement, spawnColors: readonly string[]): void {
  const canvases = surface.querySelectorAll?.<HTMLCanvasElement>('canvas[data-tile-generator]');
  if (!canvases) return;
  for (const canvas of Array.from(canvases)) paintTileSilhouette(canvas, spawnColors);
}

function paintTileSilhouette(canvas: HTMLCanvasElement, spawnColors: readonly string[]): void {
  const generator = canvas.getAttribute('data-tile-generator');
  const accent = canvas.getAttribute('data-tile-accent');
  canvas.width = TILE_PREVIEW.width;
  canvas.height = TILE_PREVIEW.height;
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return;

  ctx.fillStyle = '#0B1017';
  ctx.fillRect(0, 0, TILE_PREVIEW.width, TILE_PREVIEW.height);

  if (!generator) {
    // Random has no terrain to show yet; the dashed frame says so.
    ctx.strokeStyle = 'rgba(255,140,66,0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 6]);
    ctx.strokeRect(1, 1, TILE_PREVIEW.width - 2, TILE_PREVIEW.height - 2);
    ctx.setLineDash([]);
    ctx.fillStyle = '#FF8C42';
    ctx.font = '800 30px Archivo, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', TILE_PREVIEW.width / 2, TILE_PREVIEW.height / 2);
    return;
  }

  // Generated over the world's real width and height, then sampled down: the generators
  // work in field pixels, and a 246x76 heightmap comes out flat rather than in miniature.
  const fieldWidth = Number(canvas.getAttribute('data-tile-field-width')) || CONSTANTS.defaultFieldWidth;
  const heights = generateHeightmap(
    fieldWidth,
    CONSTANTS.fieldHeight,
    generator as Parameters<typeof generateHeightmap>[2],
    createRng(TILE_PREVIEW_SEED),
  );
  const scaleY = TILE_PREVIEW.height / CONSTANTS.fieldHeight;
  const surfaceAt = (x: number): number =>
    (heights[Math.min(fieldWidth - 1, Math.round((x / TILE_PREVIEW.width) * fieldWidth))]
      ?? CONSTANTS.fieldHeight) * scaleY;

  ctx.beginPath();
  ctx.moveTo(0, TILE_PREVIEW.height);
  for (let x = 0; x < TILE_PREVIEW.width; x++) ctx.lineTo(x, surfaceAt(x));
  ctx.lineTo(TILE_PREVIEW.width - 1, TILE_PREVIEW.height);
  ctx.closePath();
  ctx.fillStyle = 'rgba(201,168,124,0.13)';
  ctx.fill();

  ctx.beginPath();
  for (let x = 0; x < TILE_PREVIEW.width; x++) {
    if (x === 0) ctx.moveTo(x, surfaceAt(x));
    else ctx.lineTo(x, surfaceAt(x));
  }
  ctx.strokeStyle = accent ?? '#C9A87C';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Both spawns, at the same fraction of the field the world inserts them at, in the colours
  // the crews chose — the tile is a preview of this match, not of a default one.
  const inset = CONSTANTS.spawnInsetPx / fieldWidth;
  spawnColors.forEach((color, index) => {
    const x = TILE_PREVIEW.width * (index === 0 ? inset : 1 - inset);
    ctx.fillStyle = color;
    ctx.fillRect(x - 3, surfaceAt(x) - 4, 6, 4);
  });
}

/**
 * The crew's tank at 2.6x on its own strip of ground, repainted on every render so a colour
 * change shows immediately.
 *
 * Runs after mount because it needs the canvas' laid-out width, and sizes the backing store
 * by `devicePixelRatio` the way `resizeSceneCanvas` in `src/main.ts` does. Silently does
 * nothing without a 2D context, which is the headless case.
 */
const CREW_PREVIEW = { groundFraction: 0.74, scale: 2.6 } as const;

function paintCrewPreviews(surface: HTMLElement): void {
  const canvases = surface.querySelectorAll?.<HTMLCanvasElement>('canvas[data-crew-preview]');
  if (!canvases) return;
  for (const canvas of Array.from(canvases)) paintCrewPreview(canvas);
}

function paintCrewPreview(canvas: HTMLCanvasElement): void {
  const color = canvas.getAttribute('data-crew-preview-color');
  const bounds = canvas.getBoundingClientRect?.();
  if (!bounds) return;
  const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(bounds.width));
  const height = Math.max(1, Math.round(bounds.height));
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  // The same sand hairline the battlefield tiles stand their terrain on.
  const groundY = Math.round(height * CREW_PREVIEW.groundFraction);
  ctx.fillStyle = 'rgba(201,168,124,0.06)';
  ctx.fillRect(0, groundY, width, height - groundY);
  ctx.fillStyle = 'rgba(201,168,124,0.24)';
  ctx.fillRect(0, groundY, width, 1);

  ctx.save();
  ctx.translate(width / 2, groundY);
  ctx.scale(CREW_PREVIEW.scale, CREW_PREVIEW.scale);
  drawTankSilhouette(ctx, {
    x: 0,
    y: 0,
    direction: canvas.getAttribute('data-crew-preview-direction') === '-1' ? -1 : 1,
    player: canvas.getAttribute('data-crew-preview') === '1' ? 1 : 0,
    angleDeg: Number(canvas.getAttribute('data-crew-preview-angle')),
    health: CONSTANTS.damage.startingHealth,
    active: false,
    hideHealth: true,
    ...(color === null ? {} : { color }),
  });
  ctx.restore();
}

function crewColors(config: MatchConfig): readonly string[] {
  return config.crews.map((crew) => crew.color);
}

/** `data-crew-player` on a swatch, `data-crew-name` on the field: both name a crew index. */
function crewPlayer(control: Element): 0 | 1 {
  const value = control.getAttribute('data-crew-player') ?? control.getAttribute('data-crew-name');
  return value === '1' ? 1 : 0;
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

/**
 * Which field was being edited, so a re-render can put the player back in it.
 *
 * Every render replaces the whole surface, which is what keeps the view a pure function of
 * flow state — but a field that reports each keystroke would otherwise lose focus and its
 * caret on the first character typed. The attributes below already identify a field
 * uniquely, so they double as the key across a rebuild.
 */
const FIELD_KEYS: readonly string[] = Object.freeze(['data-crew-name', 'data-config-field']);

interface FieldFocus {
  readonly selector: string;
  readonly start: number | null;
  readonly end: number | null;
}

function captureFieldFocus(document: Document, root: HTMLElement): FieldFocus | null {
  const active = document.activeElement as HTMLInputElement | null;
  if (!active || !root.contains?.(active)) return null;
  for (const key of FIELD_KEYS) {
    const value = active.getAttribute?.(key);
    if (value === null || value === undefined) continue;
    return {
      selector: `[${key}="${value}"]`,
      start: typeof active.selectionStart === 'number' ? active.selectionStart : null,
      end: typeof active.selectionEnd === 'number' ? active.selectionEnd : null,
    };
  }
  return null;
}

function restoreFieldFocus(surface: HTMLElement, focus: FieldFocus | null): boolean {
  if (!focus) return false;
  const field = surface.querySelector?.<HTMLInputElement>(focus.selector);
  if (!field || field.disabled) return false;
  field.focus?.();
  if (focus.start !== null && typeof field.setSelectionRange === 'function') {
    field.setSelectionRange(focus.start, focus.end ?? focus.start);
  }
  return true;
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
