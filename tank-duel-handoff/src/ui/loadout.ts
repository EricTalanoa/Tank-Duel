import { PRESENTATION } from '../render/presentation';
import { CONSTANTS } from '../sim/constants';
import { cpuTierById } from '../sim/cpu';
import { createLoadout, toggleShell, validateLoadout, type Loadout, type LoadoutValidation } from '../sim/loadout';
import { type PlayerIndex, makePlayerLoadouts, type PlayerLoadouts } from '../sim/playerLoadouts';
import { PLAYABLE_SHELL_IDS, PLAYABLE_WEAPONS, STANDARD_SHELL_IDS } from '../sim/weapons';
import { CREATE_DEFAULT_CPU_TIER_ID, type CpuTierId, type MatchMode } from './config';

export interface LoadoutCardModel {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly cost: number;
  readonly ammo: number | 'inf';
  readonly mass: number;
  readonly locked: boolean;
  readonly selected: boolean;
  readonly disabled: boolean;
}

export interface PlayerLoadoutPanelModel {
  readonly label: string;
  readonly editable: boolean;
  readonly deploymentIds: readonly string[];
  readonly validation: LoadoutValidation;
  readonly cards: readonly LoadoutCardModel[];
  readonly cpuTierLabel?: string;
}

export interface PlayerLoadoutEditorOptions {
  readonly enabledShellIds?: readonly string[];
  readonly initialPlayerLoadoutIds?: PlayerLoadouts;
  readonly mode?: MatchMode;
  readonly cpuTierId?: CpuTierId;
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
        cost: shell.cost,
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
  const loadouts: [Loadout, Loadout] = [
    ownedLoadout(initialPlayerLoadoutIds[0], enabledShellIds),
    ownedLoadout(mode === 'cpu' ? cpuPlayerLoadoutIds() : initialPlayerLoadoutIds[1],
      mode === 'cpu' ? STANDARD_SHELL_IDS : enabledShellIds),
  ];
  let players: [PlayerLoadoutPanelModel, PlayerLoadoutPanelModel] = [
    playerPanelModel(0, loadouts[0], enabledShellIds),
    mode === 'cpu'
      ? cpuPanelModel(loadouts[1], cpuTier.name)
      : playerPanelModel(1, loadouts[1], enabledShellIds),
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
        players = [playerPanelModel(0, loadouts[0], enabledShellIds), players[1]];
      } else {
        players = [players[0], playerPanelModel(1, loadouts[1], enabledShellIds)];
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
  readonly enabledShellIds?: readonly string[];
  readonly initialPlayerLoadoutIds?: PlayerLoadouts;
  readonly mode?: MatchMode;
  readonly cpuTierId?: CpuTierId;
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

  const render = (): void => {
    const panels = element(document, 'div', `loadout-panels${options.mode === 'cpu' ? ' is-cpu' : ''}`);
    model.players.forEach((player, index) => panels.append(
      player.editable ? renderPanel(document, player, index) : renderCpuSummary(document, player),
    ));
    const deploy = textElement(document, 'button', 'DEPLOY BOTH LOADOUTS', 'deploy') as HTMLButtonElement;
    deploy.setAttribute('type', 'button');
    deploy.setAttribute('data-deploy', '');
    deploy.disabled = !model.canDeploy;
    overlay.replaceChildren(panels, deploy);
  };

  const onClick = (event: Event): void => {
    if (disposed) return;
    const target = closestElement(event.target, '[data-shell], [data-deploy]');
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

function ownedLoadout(initialIds: readonly string[], enabledShellIds: readonly string[]): Loadout {
  const enabledSet = enabledShellSet(enabledShellIds);
  return createLoadout(initialIds.filter(
    (id) => id !== CONSTANTS.loadout.freeShell && enabledSet.has(id),
  ));
}

function playerPanelModel(
  player: PlayerIndex,
  loadout: Loadout,
  enabledShellIds: readonly string[],
): PlayerLoadoutPanelModel {
  const deploymentIds = deploymentShellIds(loadout, enabledShellIds);
  const activeLoadout = createLoadout(deploymentIds.slice(1));
  return Object.freeze({
    label: PRESENTATION.players[player].label,
    editable: true,
    deploymentIds: Object.freeze([...deploymentIds]),
    validation: Object.freeze(validateLoadout(activeLoadout)),
    cards: Object.freeze([...loadoutCardModels(activeLoadout, enabledShellIds)]),
  });
}

function cpuPanelModel(loadout: Loadout, cpuTierLabel: string): PlayerLoadoutPanelModel {
  const deploymentIds = deploymentShellIds(loadout, STANDARD_SHELL_IDS);
  const activeLoadout = createLoadout(deploymentIds.slice(1));
  return Object.freeze({
    label: 'CPU opponent',
    editable: false,
    cpuTierLabel,
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
  const header = element(document, 'header');
  header.append(
    textElement(document, 'p', player.label),
    textElement(document, 'h1', 'Choose your arsenal'),
    textElement(document, 'output', `${player.validation.pointsUsed}/${CONSTANTS.loadout.points} POINTS · ${player.validation.optionalSlotsUsed}/${CONSTANTS.loadout.slots} SLOTS`),
  );
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
      textElement(document, 'small', `${card.locked ? 'FREE · LOCKED' : `${card.cost} PT`} · ${card.ammo === 'inf' ? '∞' : card.ammo} AMMO · MASS ${card.mass}`),
    );
    grid.append(button);
  }
  panel.append(header, grid);
  return panel;
}

function renderCpuSummary(document: Document, player: PlayerLoadoutPanelModel): HTMLElement {
  const panel = element(document, 'section', 'loadout-panel cpu-loadout-summary');
  panel.setAttribute('data-cpu-summary', '');
  panel.setAttribute('aria-label', `${player.cpuTierLabel ?? 'CPU'} deck`);
  const header = element(document, 'header');
  header.append(
    textElement(document, 'p', player.label),
    textElement(document, 'h1', 'CPU arsenal'),
    textElement(document, 'output', `${player.cpuTierLabel ?? 'CPU'} · READ ONLY`),
  );
  const deck = element(document, 'ul', 'cpu-deck-list');
  for (const card of player.cards) {
    const item = element(document, 'li');
    item.setAttribute('data-shell-id', card.id);
    item.append(
      shellIcon(document, card.icon),
      textElement(document, 'strong', card.name),
      textElement(document, 'small', `${card.ammo === 'inf' ? '∞' : card.ammo} AMMO`),
    );
    deck.append(item);
  }
  panel.append(header, deck);
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

function shellIcon(document: Document, path: string): HTMLImageElement {
  const image = document.createElement('img');
  image.className = 'shell-icon';
  image.src = `/${path}`;
  image.alt = '';
  image.setAttribute('aria-hidden', 'true');
  return image;
}
