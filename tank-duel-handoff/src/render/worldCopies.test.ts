import { describe, expect, test } from 'vitest';
import { HOLLOW } from '../sim/worlds';
import { worldCopyOffsets } from './worldCopies';

describe('worldCopyOffsets', () => {
  test('selects exactly the two adjacent copies intersecting a seam-spanning view', () => {
    expect(worldCopyOffsets({ x: HOLLOW.width - 100, width: 400 }, HOLLOW.width))
      .toEqual([0, HOLLOW.width]);
  });

  test('selects one distant copy for an unbounded flight camera', () => {
    expect(worldCopyOffsets({ x: HOLLOW.width * 2 + 100, width: 300 }, HOLLOW.width))
      .toEqual([HOLLOW.width * 2]);
  });

  test('selects negative and canonical copies on the left seam', () => {
    expect(worldCopyOffsets({ x: -100, width: 200 }, HOLLOW.width))
      .toEqual([-HOLLOW.width, 0]);
  });

  test('does not include a merely touching copy at an exact view boundary', () => {
    expect(worldCopyOffsets({ x: HOLLOW.width, width: HOLLOW.width }, HOLLOW.width))
      .toEqual([HOLLOW.width]);
  });

  test('includes the preceding copy while its overflow footprint intersects the view', () => {
    expect(worldCopyOffsets(
      { x: HOLLOW.width + 1, width: 200 },
      HOLLOW.width,
      70,
    )).toEqual([0, HOLLOW.width]);
  });
});
