import { describe, expect, it, vi } from 'vitest';
import { mountTouchControls } from './touchControls';

describe('touch control surface', () => {
  it('emits aim, shell, and one fire intent, then disposes cleanly', () => {
    const root = new FakeElement('div');
    const onAngle = vi.fn();
    const onPower = vi.fn();
    const onShell = vi.fn();
    const onFire = vi.fn();
    const controls = mountTouchControls(root as unknown as HTMLElement, {
      onAngle, onPower, onShell, onFire,
    });
    controls.render({
      angleDeg: 45,
      power: 70,
      canAim: true,
      canFire: true,
      shells: [
        { slot: 1, id: 'he', name: 'HE Shell', icon: 'assets/icons/he.svg', selected: true, disabled: false },
        { slot: 2, id: 'mortar', name: 'Heavy Mortar', icon: 'assets/icons/mortar.svg', selected: false, disabled: true },
      ],
    });

    expect(allText(root)).toContain('AMMUNITION');
    expect(allText(root)).toContain('HE SHELL');
    expect(allText(root)).toContain('HEAVY MORTAR');

    root.find('[data-angle]')!.input('52');
    root.find('[data-power]')!.input('81');
    root.find('[data-shell-slot="1"]')!.click();
    root.find('[data-shell-slot="2"]')!.click();
    root.find('[data-fire]')!.click();

    expect(onAngle).toHaveBeenCalledWith(52);
    expect(onPower).toHaveBeenCalledWith(81);
    expect(onShell).toHaveBeenCalledTimes(1);
    expect(onShell).toHaveBeenCalledWith(1);
    expect(onFire).toHaveBeenCalledTimes(1);

    controls.dispose();
    expect(root.children).toHaveLength(0);
  });

  it('steps angle and power repeatedly from the live control value', () => {
    const root = new FakeElement('div');
    const onAngle = vi.fn();
    const onPower = vi.fn();
    const controls = mountTouchControls(root as unknown as HTMLElement, {
      onAngle,
      onPower,
      onShell: vi.fn(),
      onFire: vi.fn(),
    });
    controls.render({ angleDeg: 45, power: 70, canAim: true, canFire: true, shells: [] });

    const increaseAngle = root.find('[aria-label="Increase angle"]')!;
    const decreasePower = root.find('[aria-label="Decrease power"]')!;
    increaseAngle.click();
    increaseAngle.click();
    decreasePower.click();
    decreasePower.click();

    expect(onAngle.mock.calls).toEqual([[46], [47]]);
    expect(onPower.mock.calls).toEqual([[69], [68]]);
    expect(root.find('[data-angle]')?.value).toBe('47');
    expect(root.find('[data-power]')?.value).toBe('68');
  });
});

function allText(node: FakeElement): string {
  return `${node.textContent} ${node.children.map(allText).join(' ')}`.trim();
}

type Listener = (event: { target: FakeElement }) => void;

class FakeElement {
  readonly ownerDocument = { createElement: (tag: string) => new FakeElement(tag) };
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Set<Listener>>();
  parentElement: FakeElement | null = null;
  className = '';
  textContent = '';
  value = '';
  disabled = false;
  type = '';

  constructor(readonly tagName: string) {}
  append(...nodes: FakeElement[]): void { for (const node of nodes) { node.parentElement = this; this.children.push(node); } }
  replaceChildren(...nodes: FakeElement[]): void { this.children.splice(0); this.append(...nodes); }
  remove(): void { if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1); }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
  addEventListener(type: string, listener: Listener): void { const set = this.listeners.get(type) ?? new Set(); set.add(listener); this.listeners.set(type, set); }
  removeEventListener(type: string, listener: Listener): void { this.listeners.get(type)?.delete(listener); }
  find(selector: string): FakeElement | null {
    const match = /^\[([^=\]]+)(?:="([^"]+)")?\]$/.exec(selector);
    if (match && this.attributes.has(match[1]!) && (match[2] === undefined || this.getAttribute(match[1]!) === match[2])) return this;
    for (const child of this.children) { const found = child.find(selector); if (found) return found; }
    return null;
  }
  private dispatch(type: string): void {
    if (this.disabled) return;
    let node: FakeElement | null = this;
    while (node) { for (const listener of node.listeners.get(type) ?? []) listener({ target: this }); node = node.parentElement; }
  }
  click(): void { this.dispatch('click'); }
  input(value: string): void { this.value = value; this.dispatch('input'); }
}
