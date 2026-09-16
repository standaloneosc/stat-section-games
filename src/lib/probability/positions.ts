import type { Position } from "./types";

export function posKey(position: Position): string {
  return `${position.x},${position.y}`;
}

export function parsePosKey(key: string): Position {
  const [xRaw, yRaw] = key.split(",");
  const x = Number(xRaw);
  const y = Number(yRaw);
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    throw new Error(`Invalid position key: ${key}`);
  }
  return { x, y };
}

export function positionsEqual(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

export function inBounds(position: Position, gridSize: number): boolean {
  return (
    position.x >= 0 &&
    position.y >= 0 &&
    position.x < gridSize &&
    position.y < gridSize
  );
}

export function allSquares(gridSize: number): Position[] {
  const squares: Position[] = [];
  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      squares.push({ x, y });
    }
  }
  return squares;
}

export function formatPosition(position: Position): string {
  return `(${position.x}, ${position.y})`;
}

export function directionLabel(from: Position, to: Position): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) {
    return "Stay";
  }
  const vertical = dy < 0 ? "Up" : dy > 0 ? "Down" : "";
  const horizontal = dx < 0 ? "left" : dx > 0 ? "right" : "";
  if (vertical && horizontal) {
    return `${vertical}-${horizontal}`;
  }
  if (vertical) {
    return vertical;
  }
  if (dx < 0) {
    return "Left";
  }
  if (dx > 0) {
    return "Right";
  }
  return "Nearby";
}

export const ORTHOGONAL_DELTAS: Position[] = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

export const DIAGONAL_DELTAS: Position[] = [
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: 1, y: 1 },
];

export const EIGHT_DELTAS: Position[] = [
  ...ORTHOGONAL_DELTAS,
  ...DIAGONAL_DELTAS,
];
