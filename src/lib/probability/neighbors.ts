import type { MonsterTrait, Position } from "./types";
import { EIGHT_DELTAS, inBounds, ORTHOGONAL_DELTAS } from "./positions";

export function getNeighborPositions(
  position: Position,
  trait: MonsterTrait,
  gridSize: number
): Position[] {
  const deltas = trait === "walker" ? ORTHOGONAL_DELTAS : EIGHT_DELTAS;
  const neighbors: Position[] = [];
  for (const delta of deltas) {
    const next = { x: position.x + delta.x, y: position.y + delta.y };
    if (inBounds(next, gridSize)) {
      neighbors.push(next);
    }
  }
  return neighbors;
}

export function getLocalDestinations(
  position: Position,
  trait: MonsterTrait,
  gridSize: number
): Position[] {
  return [position, ...getNeighborPositions(position, trait, gridSize)];
}
