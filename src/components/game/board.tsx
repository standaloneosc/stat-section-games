"use client";

import { Bug, Crosshair, Footprints } from "lucide-react";
import { cn } from "@/lib/utils";
import { allSquares, formatPercent, formatPosition, parsePosKey, type MonsterTrait, type Position } from "@/lib/probability";

const TRAIT_ICON = {
  walker: Footprints,
  spider: Bug,
  hunter: Crosshair,
} as const;

export function GameBoard(props: {
  monsterTrait: MonsterTrait;
  currentPosition: Position;
  legalSquares: string[];
  selectedSquare: string | null;
  destination?: Position | null;
  playerCounts?: Record<string, number> | null;
  hints?: Record<string, number> | null;
  resolved?: boolean;
  disabled?: boolean;
  onSelect?: (square: string) => void;
}) {
  const Icon = TRAIT_ICON[props.monsterTrait];
  const destKey = props.destination ? `${props.destination.x},${props.destination.y}` : null;
  const startKey = `${props.currentPosition.x},${props.currentPosition.y}`;

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>x increases right, y increases down</span>
        <span className="capitalize">{props.monsterTrait} at {formatPosition(props.currentPosition)}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {allSquares(3).map((position) => {
          const key = `${position.x},${position.y}`;
          const legal = props.legalSquares.includes(key);
          const selected = props.selectedSquare === key;
          const isStart = key === startKey;
          const isDest = destKey === key;
          const count = props.playerCounts?.[key];
          const hint = props.hints?.[key];
          return (
            <button
              key={key}
              type="button"
              disabled={props.disabled || !legal}
              onClick={() => props.onSelect?.(key)}
              className={cn(
                "relative flex aspect-square min-h-[5.5rem] flex-col items-center justify-center rounded-2xl border-2 p-2 text-center transition sm:min-h-[6.5rem]",
                legal
                  ? "border-emerald-500/40 bg-emerald-950/40 hover:border-amber-300 hover:bg-emerald-900/50"
                  : "cursor-not-allowed border-border/60 bg-muted/30 opacity-50",
                selected && "border-amber-300 bg-amber-500/20 ring-2 ring-amber-300/70",
                isStart && !props.resolved && "border-rose-400/80",
                isDest && "border-rose-500 bg-rose-600/30 ring-2 ring-rose-400",
                props.disabled && "pointer-events-none"
              )}
            >
              <span className="absolute top-1.5 left-1.5 font-mono text-[10px] text-muted-foreground">
                {formatPosition(position)}
              </span>
              {isStart ? (
                <span className="flex flex-col items-center gap-1 text-rose-200">
                  <Icon className="size-7" />
                  <span className="text-[11px] font-medium tracking-wide uppercase">
                    {props.resolved ? "Started" : "Monster"}
                  </span>
                </span>
              ) : null}
              {isDest && props.resolved ? (
                <span className="flex flex-col items-center gap-1 text-rose-100">
                  <Icon className="size-7" />
                  <span className="text-[11px] font-medium tracking-wide uppercase">Landed</span>
                </span>
              ) : null}
              {!isStart && !isDest ? (
                <span className="text-sm font-medium text-foreground/80">
                  {legal ? "Hide here" : "Out of range"}
                </span>
              ) : null}
              {typeof hint === "number" ? (
                <span className="mt-1 font-mono text-xs text-amber-200">
                  P = {formatPercent(hint, 1)}
                </span>
              ) : null}
              {typeof count === "number" && props.resolved ? (
                <span className="mt-1 text-xs text-foreground">
                  {count} {count === 1 ? "player" : "players"}
                </span>
              ) : null}
              {selected ? (
                <span className="absolute right-1.5 bottom-1.5 text-[10px] font-semibold tracking-wide text-amber-200 uppercase">
                  Yours
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function traitLabel(trait: MonsterTrait): string {
  return trait[0].toUpperCase() + trait.slice(1);
}

export function squareLabel(square: string): string {
  return formatPosition(parsePosKey(square));
}
