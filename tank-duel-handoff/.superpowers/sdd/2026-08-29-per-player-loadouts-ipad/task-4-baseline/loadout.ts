import { CONSTANTS } from '../sim/constants';
import { createLoadout, equippedWeapons, toggleShell, validateLoadout, type Loadout } from '../sim/loadout';
import { PLAYABLE_WEAPONS, STANDARD_WEAPONS } from '../sim/weapons';

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

const PLAYABLE_SHELL_IDS = PLAYABLE_WEAPONS.map(({ shell }) => shell.id);

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

export interface MountLoadoutOptions {
  readonly onDeploy: (ids: readonly string[]) => void;
  readonly enabledShellIds?: readonly string[];
  readonly initialShellIds?: readonly string[];
}

export interface MountedLoadout {
  dispose(): void;
}

export function mountLoadout(root: HTMLElement, options: MountLoadoutOptions): MountedLoadout {
  const document = root.ownerDocument;
  const enabledShellIds = options.enabledShellIds ?? PLAYABLE_SHELL_IDS;
  const enabledSet = enabledShellSet(enabledShellIds);
  const initialShellIds = options.initialShellIds ?? STANDARD_WEAPONS.map(({ shell }) => shell.id);
  const loadout = createLoadout(
    initialShellIds.filter((id) => id !== CONSTANTS.loadout.freeShell && enabledSet.has(id)),
  );
  const overlay = document.createElement('section');
  let disposed = false;
  overlay.className = 'loadout-overlay';
  overlay.setAttribute('aria-label', 'Choose loadout');
  root.append(overlay);

  const render = (): void => {
    const activeIds = deploymentShellIds(loadout, enabledShellIds);
    const activeLoadout = createLoadout(activeIds.slice(1));
    const validation = validateLoadout(activeLoadout);
    const panel = element(document, 'div', 'loadout-panel');
    const header = element(document, 'header');
    header.append(
      textElement(document, 'p', 'SHARED HOTSEAT DECK'),
      textElement(document, 'h1', 'Choose your arsenal'),
      textElement(document, 'output', `${validation.pointsUsed}/${CONSTANTS.loadout.points} POINTS · ${validation.optionalSlotsUsed}/${CONSTANTS.loadout.slots} SLOTS`),
    );
    const grid = element(document, 'div', 'loadout-grid');
    for (const card of loadoutCardModels(activeLoadout, enabledShellIds)) {
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
    const deploy = textElement(document, 'button', `DEPLOY ${equippedWeapons(activeLoadout).length} SHELLS`, 'deploy') as HTMLButtonElement;
    deploy.setAttribute('type', 'button');
    deploy.setAttribute('data-deploy', '');
    deploy.disabled = !validation.valid;
    panel.append(header, grid, deploy);
    overlay.replaceChildren(panel);
  };

  const onClick = (event: Event): void => {
    if (disposed) return;
    const target = closestElement(event.target, '[data-shell], [data-deploy]');
    if (!target || !overlay.contains(target) || (target as HTMLButtonElement).disabled) return;
    const shellId = target.getAttribute('data-shell');
    if (shellId) {
      try {
        toggleShell(loadout, shellId);
      } catch {
        return;
      }
      render();
      return;
    }
    if (target.hasAttribute('data-deploy')) {
      const ids = deploymentShellIds(loadout, enabledShellIds);
      dispose();
      options.onDeploy(ids);
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
