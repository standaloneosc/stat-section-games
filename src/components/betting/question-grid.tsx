import type { PublicGridItem } from "@/lib/betting";
import { MultiplierBadge } from "./multiplier-badge";

export function QuestionGrid(props: {
  items: PublicGridItem[];
  selectedId?: number | null;
  onSelect?: (id: number) => void;
  showHostCounts?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {props.items.map((item) => {
        const selected = item.id === props.selectedId;
        const result = item.yourResult;
        const tone = result
          ? result.correct
            ? "border-emerald-400/50 bg-emerald-400/10"
            : "border-destructive/40 bg-destructive/10"
          : selected
            ? "border-amber-300/70 bg-amber-200/10"
            : "border-border bg-card";
        return (
          <button
            key={item.id}
            type="button"
            disabled={props.disabled && !item.answered}
            onClick={() => props.onSelect?.(item.id)}
            className={`flex min-h-28 flex-col gap-2 rounded-xl border p-3 text-left transition-colors ${tone} ${
              props.onSelect ? "hover:bg-muted/40" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-muted-foreground">Q{item.id}</span>
              <MultiplierBadge multiplier={item.multiplier} label={item.multiplierLabel} />
            </div>
            <p className="line-clamp-3 text-sm leading-5">{item.prompt}</p>
            <p className="mt-auto text-xs text-muted-foreground">
              {result
                ? result.correct
                  ? "Correct — already locked"
                  : "Incorrect — already locked"
                : "Open — tap to bet"}
              {props.showHostCounts ? ` · ${item.answeredByCount} group${item.answeredByCount === 1 ? "" : "s"}` : ""}
            </p>
          </button>
        );
      })}
    </div>
  );
}
