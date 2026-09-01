function assertPositiveFiniteWidth(width: number): void {
  if (!Number.isFinite(width) || width <= 0) {
    throw new Error('width must be a finite number greater than 0');
  }
}

export function wrapX(x: number, width: number): number {
  assertPositiveFiniteWidth(width);
  return ((x % width) + width) % width;
}

export function wrappedDelta(fromX: number, toX: number, width: number): number {
  assertPositiveFiniteWidth(width);
  return wrapX(toX - fromX + width / 2, width) - width / 2;
}

export function nearestWrappedX(canonicalX: number, referenceX: number, width: number): number {
  assertPositiveFiniteWidth(width);
  return canonicalX + Math.round((referenceX - canonicalX) / width) * width;
}

export function visibleCopyRange(
  viewX: number,
  viewWidth: number,
  worldWidth: number,
): { readonly first: number; readonly last: number } {
  assertPositiveFiniteWidth(viewWidth);
  assertPositiveFiniteWidth(worldWidth);

  return {
    first: Math.floor(viewX / worldWidth),
    last: Math.ceil((viewX + viewWidth) / worldWidth) - 1,
  };
}
