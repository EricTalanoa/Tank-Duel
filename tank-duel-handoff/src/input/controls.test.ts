import { describe, expect, it } from 'vitest';
import { shellSlotForCode } from './controls';

describe('shell slot controls', () => {
  it.each([1, 2, 3, 4, 5, 6])('maps Digit%i to its stable slot', (slot) => {
    expect(shellSlotForCode(`Digit${slot}`)).toBe(slot);
  });

  it('ignores keys outside the six-shell deck', () => {
    expect(shellSlotForCode('Digit0')).toBeNull();
    expect(shellSlotForCode('Digit7')).toBeNull();
  });

  it('limits digits to the active deck length', () => {
    expect(shellSlotForCode('Digit3', 3)).toBe(3);
    expect(shellSlotForCode('Digit4', 3)).toBeNull();
  });
});
