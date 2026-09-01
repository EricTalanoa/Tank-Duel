export interface TouchShellControl {
  readonly slot: number;
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly selected: boolean;
  readonly disabled: boolean;
}

export interface TouchControlState {
  readonly angleDeg: number;
  readonly power: number;
  readonly canAim: boolean;
  readonly canFire: boolean;
  readonly shells: readonly TouchShellControl[];
}

export interface TouchControlCallbacks {
  readonly onAngle: (value: number) => void;
  readonly onPower: (value: number) => void;
  readonly onShell: (slot: number) => void;
  readonly onFire: () => void;
}

export interface MountedTouchControls {
  render(state: TouchControlState): void;
  dispose(): void;
}

export function mountTouchControls(
  root: HTMLElement,
  callbacks: TouchControlCallbacks,
): MountedTouchControls {
  const document = root.ownerDocument;
  const surface = document.createElement('section');
  surface.className = 'touch-controls';
  surface.setAttribute('aria-label', 'Touch firing controls');
  root.append(surface);
  let disposed = false;
  let currentState: TouchControlState | null = null;

  const render = (state: TouchControlState): void => {
    if (disposed) return;
    if (currentState && sameTouchState(currentState, state)) return;
    const updateLocal = (patch: Partial<Pick<TouchControlState, 'angleDeg' | 'power'>>): void => {
      currentState = { ...(currentState ?? state), ...patch };
    };
    const aim = document.createElement('div');
    aim.className = 'touch-aim-controls';
    aim.append(
      aimControl(document, 'Angle', 'angle', state.angleDeg, 0, 90, state.canAim, (value) => {
        updateLocal({ angleDeg: value });
        callbacks.onAngle(value);
      }),
      aimControl(document, 'Power', 'power', state.power, 10, 100, state.canAim, (value) => {
        updateLocal({ power: value });
        callbacks.onPower(value);
      }),
    );

    const deck = document.createElement('div');
    deck.className = 'touch-deck';
    deck.setAttribute('aria-label', 'Ammunition');
    const deckLabel = document.createElement('span');
    deckLabel.className = 'touch-deck-label';
    deckLabel.textContent = 'AMMUNITION';
    const shellButtons = document.createElement('div');
    shellButtons.className = 'touch-shells';
    for (const shell of state.shells) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `touch-shell${shell.selected ? ' is-selected' : ''}`;
      button.disabled = shell.disabled || !state.canAim;
      button.setAttribute('data-shell-slot', String(shell.slot));
      button.setAttribute('aria-label', `${shell.slot}. ${shell.name}`);
      button.setAttribute('aria-pressed', String(shell.selected));
      const icon = document.createElement('span');
      icon.className = 'shell-icon';
      icon.setAttribute('style', `--icon: url("/${shell.icon}")`);
      icon.setAttribute('aria-hidden', 'true');
      const slot = document.createElement('small');
      slot.textContent = String(shell.slot);
      const name = document.createElement('span');
      name.className = 'touch-shell-name';
      name.textContent = shell.name.toUpperCase();
      button.append(icon, slot, name);
      button.addEventListener('click', () => callbacks.onShell(shell.slot));
      shellButtons.append(button);
    }
    deck.append(deckLabel, shellButtons);

    const fire = document.createElement('button');
    fire.type = 'button';
    fire.className = 'touch-fire';
    fire.textContent = 'Fire';
    fire.disabled = !state.canFire;
    fire.setAttribute('data-fire', '');
    fire.addEventListener('click', callbacks.onFire);
    surface.replaceChildren(aim, deck, fire);
    currentState = state;
  };

  return {
    render,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      surface.remove();
    },
  };
}

function sameTouchState(left: TouchControlState, right: TouchControlState): boolean {
  return left.angleDeg === right.angleDeg &&
    left.power === right.power &&
    left.canAim === right.canAim &&
    left.canFire === right.canFire &&
    left.shells.length === right.shells.length &&
    left.shells.every((shell, index) => {
      const other = right.shells[index];
      return other !== undefined && shell.slot === other.slot && shell.id === other.id &&
        shell.selected === other.selected && shell.disabled === other.disabled;
    });
}

function aimControl(
  document: Document,
  labelText: string,
  field: 'angle' | 'power',
  value: number,
  min: number,
  max: number,
  enabled: boolean,
  emit: (value: number) => void,
): HTMLElement {
  const group = document.createElement('div');
  group.className = 'touch-aim-group';
  const label = document.createElement('label');
  const valueLabel = document.createElement('span');
  const formatValue = (next: number): string =>
    `${labelText} ${Math.round(next)}${field === 'angle' ? '°' : ''}`;
  valueLabel.textContent = formatValue(value);
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = String(min);
  slider.max = String(max);
  slider.step = '1';
  slider.value = String(Math.round(value));
  slider.disabled = !enabled;
  slider.setAttribute(`data-${field}`, '');
  const setValue = (next: number): void => {
    const bounded = Math.min(max, Math.max(min, Math.round(next)));
    slider.value = String(bounded);
    valueLabel.textContent = formatValue(bounded);
    emit(bounded);
  };
  slider.addEventListener('input', () => setValue(Number(slider.value)));
  label.append(valueLabel, slider);

  const buttons = document.createElement('div');
  buttons.className = 'touch-step-buttons';
  for (const delta of [-1, 1]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = delta < 0 ? '−' : '+';
    button.disabled = !enabled;
    button.setAttribute('aria-label', `${delta < 0 ? 'Decrease' : 'Increase'} ${labelText.toLowerCase()}`);
    button.addEventListener('click', () => setValue(Number(slider.value) + delta));
    buttons.append(button);
  }
  group.append(label, buttons);
  return group;
}
