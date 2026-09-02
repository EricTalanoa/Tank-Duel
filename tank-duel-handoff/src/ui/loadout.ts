import { PRESENTATION } from '../render/presentation';
import { CONSTANTS } from '../sim/constants';
import { cpuTierById, type CpuTier } from '../sim/cpu';
import { createLoadout, toggleShell, validateLoadout, type Loadout, type LoadoutValidation } from '../sim/loadout';
import { type PlayerIndex, makePlayerLoadouts, type PlayerLoadouts } from '../sim/playerLoadouts';
import { PLAYABLE_SHELL_IDS, PLAYABLE_WEAPONS, STANDARD_SHELL_IDS } from '../sim/weapons';
import { CREATE_DEFAULT_CPU_TIER_ID, type CpuTierId, type MatchMode } from './config';

export interface LoadoutCardModel {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly ammo: number | 'inf';
  readonly mass: number;
  readonly locked: boolean;
  readonly selected: boolean;
  readonly disabled: boolean;
}

export interface PlayerLoadoutPanelModel {
  readonly label: string;
  /** `P1` / `P2`, or `CPU` for the read-only panel. */
  readonly tag: string;
  /** The tag chip's fill: the player colour from `spec/presentation.json`. */
  readonly color: string | null;
  readonly editable: boolean;
  readonly deploymentIds: readonly string[];
  readonly validation: LoadoutValidation;
  readonly cards: readonly LoadoutCardModel[];
  readonly cpuTierLabel?: string;
  /** The tier's measured performance, straight from `spec/cpu.json`. */
  readonly cpuTierStats?: readonly string[];
}

/** The crew identity chosen on `CREW`: what to call each player and how to tint their tag. */
export interface LoadoutCrew {
  readonly name: string;
  readonly color: string;
}

export interface PlayerLoadoutEditorOptions {
  readonly enabledShellIds?: readonly string[];
  readonly initialPlayerLoadoutIds?: PlayerLoadouts;
  readonly mode?: MatchMode;
  readonly cpuTierId?: CpuTierId;
  readonly crews?: readonly [LoadoutCrew, LoadoutCrew];
}

export interface PlayerLoadoutEditorModel {
  readonly players: readonly [PlayerLoadoutPanelModel, PlayerLoadoutPanelModel];
  readonly canDeploy: boolean;
  toggle(player: PlayerIndex, shellId: string): void;
  deployment(): PlayerLoadouts;
}

const CPU_PLAYER_LOADOUT_IDS = makePlayerLoadouts(STANDARD_SHELL_IDS, STANDARD_SHELL_IDS)[1];

export function cpuPlayerLoadoutIds(): readonly string[] {
  return CPU_PLAYER_LOADOUT_IDS;
}

export function loadoutCardModels(
  loadout: Loadout,
  enabledShellIds: readonly string[] = PLAYABLE_SHELL_IDS,
): readonly LoadoutCardModel[] {
  const deploymentIds = deploymentShellIds(loadout, enabledShellIds);
  const projectedLoadout = createLoadout(deploymentIds.slice(1));
  const enabledSet = enabledShellSet(enabledShellIds);

  return PLAYABLE_WEAPONS
    .filter(({ shell }) => enabledSet.has(shell.id))
    .map(({ shell }) => {
      let disabled = false;
      if (!projectedLoadout.ids.includes(shell.id) && shell.id !== CONSTANTS.loadout.freeShell) {
        try {
          toggleShell({ ids: [...projectedLoadout.ids] }, shell.id);
        } catch {
          disabled = true;
        }
      }
      return {
        id: shell.id,
        name: shell.name,
        icon: shell.icon,
        ammo: shell.ammo,
        mass: shell.mass,
        locked: shell.id === CONSTANTS.loadout.freeShell,
        selected: projectedLoadout.ids.includes(shell.id),
        disabled,
      };
    });
}

export function deploymentShellIds(
  loadout: Loadout,
  enabledShellIds: readonly string[] = PLAYABLE_SHELL_IDS,
): readonly string[] {
  const enabledSet = enabledShellSet(enabledShellIds);
  return PLAYABLE_WEAPONS
    .filter(({ shell }) => enabledSet.has(shell.id) && loadout.ids.includes(shell.id))
    .map(({ shell }) => shell.id);
}

export function createPlayerLoadoutEditorModel(
  options: PlayerLoadoutEditorOptions = {},
): PlayerLoadoutEditorModel {
  const enabledShellIds = options.enabledShellIds ?? PLAYABLE_SHELL_IDS;
  const mode = options.mode ?? 'local';
  const cpuTier = cpuTierById(options.cpuTierId ?? CREATE_DEFAULT_CPU_TIER_ID);
  if (!cpuTier) throw new Error(`Unknown CPU tier: ${options.cpuTierId}`);
  const initialPlayerLoadoutIds = options.initialPlayerLoadoutIds ??
    makePlayerLoadouts(STANDARD_SHELL_IDS, STANDARD_SHELL_IDS);
  const crews = options.crews ?? defaultCrews();
  const loadouts: [Loadout, Loadout] = [
    ownedLoadout(initialPlayerLoadoutIds[0], enabledShellIds),
    ownedLoadout(mode === 'cpu' ? cpuPlayerLoadoutIds() : initialPlayerLoadoutIds[1],
      mode === 'cpu' ? STANDARD_SHELL_IDS : enabledShellIds),
  ];
  let players: [PlayerLoadoutPanelModel, PlayerLoadoutPanelModel] = [
    playerPanelModel(0, loadouts[0], enabledShellIds, crews[0]),
    mode === 'cpu'
      ? cpuPanelModel(loadouts[1], cpuTier)
      : playerPanelModel(1, loadouts[1], enabledShellIds, crews[1]),
  ];

  return {
    get players() {
      return players;
    },
    get canDeploy() {
      return players.every((player) => player.validation.valid);
    },
    toggle(player, shellId) {
      if (mode === 'cpu' && player === 1) return;
      toggleShell(loadouts[player], shellId);
      if (player === 0) {
        players = [playerPanelModel(0, loadouts[0], enabledShellIds, crews[0]), players[1]];
      } else {
        players = [players[0], playerPanelModel(1, loadouts[1], enabledShellIds, crews[1])];
      }
    },
    deployment() {
      return makePlayerLoadouts(
        deploymentShellIds(loadouts[0], enabledShellIds),
        mode === 'cpu'
          ? cpuPlayerLoadoutIds()
          : deploymentShellIds(loadouts[1], enabledShellIds),
      );
    },
  };
}

export interface MountLoadoutOptions {
  readonly onDeploy: (loadouts: PlayerLoadouts) => void;
  readonly onBack?: () => void;
  readonly enabledShellIds?: readonly string[];
  readonly initialPlayerLoadoutIds?: PlayerLoadouts;
  readonly mode?: MatchMode;
  readonly cpuTierId?: CpuTierId;
  readonly crews?: readonly [LoadoutCrew, LoadoutCrew];
}

export interface MountedLoadout {
  dispose(): void;
}

export function mountLoadout(root: HTMLElement, options: MountLoadoutOptions): MountedLoadout {
  const document = root.ownerDocument;
  const model = createPlayerLoadoutEditorModel(options);
  const overlay = document.createElement('section');
  let disposed = false;
  overlay.className = 'loadout-overlay';
  overlay.setAttribute('aria-label', 'Choose loadouts');
  root.append(overlay);

  const cpu = options.mode === 'cpu';
  const render = (): void => {
    const panels = element(document, 'div', `loadout-panels${cpu ? ' is-cpu' : ''}`);
    model.players.forEach((player, index) => panels.append(
      player.editable ? renderPanel(document, player, index) : renderCpuSummary(document, player),
    ));
    const deploy = textElement(
      document,
      'button',
      cpu ? 'Deploy' : 'Deploy both loadouts',
      'deploy',
    ) as HTMLButtonElement;
    deploy.setAttribute('type', 'button');
    deploy.setAttribute('data-deploy', '');
    deploy.disabled = !model.canDeploy;
    const back = textElement(document, 'button', 'Back', 'deploy is-secondary') as HTMLButtonElement;
    back.setAttribute('type', 'button');
    back.setAttribute('data-back', '');
    const actions = element(document, 'div', 'loadout-actions');
    actions.append(back, deploy);
    overlay.replaceChildren(renderHeader(document, cpu), panels, actions);
    focusHeading(overlay);
  };


  const onClick = (event: Event): void => {
    if (disposed) return;
    const target = closestElement(event.target, '[data-shell], [data-deploy], [data-back]');
    if (!target || !overlay.contains(target) || (target as HTMLButtonElement).disabled) return;
    const shellId = target.getAttribute('data-shell');
    if (shellId) {
      const player = closestElement(target, '[data-player]')?.getAttribute('data-player');
      if (player !== '0' && player !== '1') return;
      try {
        model.toggle(Number(player) as PlayerIndex, shellId);
      } catch {
        return;
      }
      render();
      return;
    }
    if (target.hasAttribute('data-deploy') && model.canDeploy) {
      const deployment = model.deployment();
      dispose();
      options.onDeploy(deployment);
      return;
    }
    if (target.hasAttribute('data-back')) {
      dispose();
      options.onBack?.();
    }
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    overlay.removeEventListener('click', onClick);
    overlay.remove();
  };

  overlay.addEventListener('click', onClick);
  render();
  return { dispose };
}

/** The screen's title, not a panel's: at ~564px a panel header cannot hold 48px display type. */
function renderHeader(document: Document, cpu: boolean): HTMLElement {
  const header = element(document, 'header', 'screen-header');
  const row = element(document, 'div', 'header-row');
  row.append(
    textElement(document, 'p', cpu ? 'Loadout · 1 v CPU' : 'Loadout', 'menu-kicker'),
    textElement(
      document,
      'p',
      `Pick any ${CONSTANTS.loadout.slots} · ${
        CONSTANTS.loadout.freeShell.toUpperCase()} is free and unlimited`,
      'menu-step',
    ),
  );
  header.append(row, textElement(document, 'h1', 'Choose your arsenal'), element(document, 'hr', 'rule'));
  return header;
}

function focusHeading(overlay: HTMLElement): void {
  const heading = overlay.querySelector?.<HTMLElement>('h1');
  if (!heading) return;
  heading.setAttribute('tabindex', '-1');
  heading.focus?.();
}

function ownedLoadout(initialIds: readonly string[], enabledShellIds: readonly string[]): Loadout {
  const enabledSet = enabledShellSet(enabledShellIds);
  return createLoadout(initialIds.filter(
    (id) => id !== CONSTANTS.loadout.freeShell && enabledSet.has(id),
  ));
}

function defaultCrews(): readonly [LoadoutCrew, LoadoutCrew] {
  return [
    { name: PRESENTATION.players[0].label, color: PRESENTATION.players[0].color },
    { name: PRESENTATION.players[1].label, color: PRESENTATION.players[1].color },
  ];
}

function playerPanelModel(
  player: PlayerIndex,
  loadout: Loadout,
  enabledShellIds: readonly string[],
  crew: LoadoutCrew,
): PlayerLoadoutPanelModel {
  const deploymentIds = deploymentShellIds(loadout, enabledShellIds);
  const activeLoadout = createLoadout(deploymentIds.slice(1));
  return Object.freeze({
    label: crew.name,
    tag: `P${player + 1}`,
    color: crew.color,
    editable: true,
    deploymentIds: Object.freeze([...deploymentIds]),
    validation: Object.freeze(validateLoadout(activeLoadout)),
    cards: Object.freeze([...loadoutCardModels(activeLoadout, enabledShellIds)]),
  });
}

function cpuPanelModel(loadout: Loadout, tier: CpuTier): PlayerLoadoutPanelModel {
  const deploymentIds = deploymentShellIds(loadout, STANDARD_SHELL_IDS);
  const activeLoadout = createLoadout(deploymentIds.slice(1));
  return Object.freeze({
    label: 'CPU opponent',
    tag: 'CPU',
    color: null,
    editable: false,
    cpuTierLabel: tier.name,
    cpuTierStats: Object.freeze([
      `Median ${tier.measuredMedianShotsToHit} shots to hit`,
      `Jitter ${tier.jitter} · Wind skill ${tier.windSkill}`,
    ]),
    deploymentIds: Object.freeze([...deploymentIds]),
    validation: Object.freeze(validateLoadout(activeLoadout)),
    cards: Object.freeze([...loadoutCardModels(activeLoadout, STANDARD_SHELL_IDS)]),
  });
}

function renderPanel(
  document: Document,
  player: PlayerLoadoutPanelModel,
  index: number,
): HTMLElement {
  const panel = element(document, 'section', 'loadout-panel');
  panel.setAttribute('data-player', String(index));
  panel.append(panelHeader(document, player, budget(document, player)));

  const grid = element(document, 'div', 'loadout-grid');
  for (const card of player.cards) {
    const button = element(document, 'button', `loadout-card${card.selected ? ' is-selected' : ''}`) as HTMLButtonElement;
    button.type = 'button';
    button.setAttribute('data-shell', card.id);
    button.setAttribute('aria-pressed', String(card.selected));
    button.disabled = card.locked || card.disabled;
    button.append(
      shellIcon(document, card.icon),
      textElement(document, 'strong', card.name),
      textElement(document, 'small', cardMeta(card)),
    );
    grid.append(button);
  }
  panel.append(grid);
  return panel;
}

/** Short and nowrap: `4 AMMO · MASS 1.55` wrapped inside a 38px + 1fr card. */
function cardMeta(card: LoadoutCardModel): string {
  const ammo = card.ammo === 'inf' ? '∞ AMMO' : `${card.ammo}×`;
  return `${ammo} · M${card.mass}`;
}

function panelHeader(
  document: Document,
  player: PlayerLoadoutPanelModel,
  aside: HTMLElement,
): HTMLElement {
  const header = element(document, 'header');
  const identity = element(document, 'div', 'panel-identity');
  const tag = textElement(document, 'span', player.tag, 'player-tag');
  if (player.color) tag.setAttribute('style', `--player-color: ${player.color}`);
  identity.append(tag, textElement(document, 'span', player.label, 'panel-label'));
  header.append(identity, aside);
  return header;
}

/**
 * Slots as a fraction and as one pip each. There is no point budget any more, so the pips
 * count the same thing the fraction does — which is what makes the deck read at a glance.
 */
function budget(document: Document, player: PlayerLoadoutPanelModel): HTMLElement {
  const wrapper = element(document, 'div', 'panel-budget');
  wrapper.append(textElement(
    document,
    'output',
    `${player.validation.optionalSlotsUsed}/${CONSTANTS.loadout.slots} SHELLS`,
  ));
  const pips = element(document, 'span', 'panel-pips');
  pips.setAttribute('aria-hidden', 'true');
  for (let pip = 0; pip < CONSTANTS.loadout.slots; pip++) {
    pips.append(element(document, 'span', pip < player.validation.optionalSlotsUsed ? 'is-spent' : ''));
  }
  wrapper.append(pips);
  return wrapper;
}

function renderCpuSummary(document: Document, player: PlayerLoadoutPanelModel): HTMLElement {
  const panel = element(document, 'section', 'loadout-panel cpu-loadout-summary');
  panel.setAttribute('data-cpu-summary', '');
  panel.setAttribute('aria-label', `${player.cpuTierLabel ?? 'CPU'} deck`);
  panel.append(panelHeader(
    document,
    { ...player, label: player.cpuTierLabel ?? 'CPU' },
    textElement(document, 'output', 'Read only'),
  ));

  const deck = element(document, 'ul', 'cpu-deck-list');
  for (const card of player.cards) {
    const item = element(document, 'li');
    item.setAttribute('data-shell-id', card.id);
    item.append(
      shellIcon(document, card.icon),
      textElement(document, 'strong', card.name),
      textElement(document, 'small', `${card.ammo === 'inf' ? '∞' : card.ammo} ammo`),
    );
    deck.append(item);
  }
  panel.append(deck);

  if (player.cpuTierStats) {
    const stats = element(document, 'p', 'cpu-tier-stats');
    for (const line of player.cpuTierStats) stats.append(textElement(document, 'span', line));
    panel.append(stats);
  }
  return panel;
}

function enabledShellSet(enabledShellIds: readonly string[]): Set<string> {
  return new Set([CONSTANTS.loadout.freeShell, ...enabledShellIds]);
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

/**
 * A masked span, not an `<img>`. The icons are `fill="none" stroke="currentColor"`; loaded
 * as an image the SVG has no inheritable colour, so `currentColor` resolves to black and
 * the icon is invisible on these panels. Masking makes one file cover every state.
 */
function shellIcon(document: Document, path: string): HTMLElement {
  const icon = element(document, 'span', 'shell-icon');
  icon.setAttribute('data-icon', `/${path}`);
  icon.setAttribute('style', `--icon: url("/${path}")`);
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}
