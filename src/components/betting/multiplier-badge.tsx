import { formatMultiplier } from "@/lib/betting";
import { cn } from "@/lib/utils";

export function MultiplierBadge(props: {
  multiplier: number;
  label?: string;
  size?: "sm" | "lg";
  className?: string;
}) {
  const text = props.label ?? formatMultiplier(props.multiplier);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border border-amber-300/40 bg-amber-200 font-mono font-semibold tracking-tight text-zinc-950",
        props.size === "lg" ? "px-3 py-1 text-2xl" : "px-2 py-0.5 text-sm",
        props.className
      )}
      title={`Correct answers pay ${text} your bet`}
    >
      {text}
    </span>
  );
}
