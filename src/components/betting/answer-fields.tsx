"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  DISTRIBUTION_FAMILIES,
  FAMILY_FIELDS,
  FAMILY_LABELS,
  type DistributionFamily,
  type PlayerAnswer,
} from "@/lib/betting";

export function AnswerFields(props: {
  kind: "number" | "distribution";
  value: PlayerAnswer;
  onChange: (next: PlayerAnswer) => void;
  disabled?: boolean;
}) {
  const { kind, value, onChange, disabled } = props;
  if (kind === "number") {
    return (
      <div className="grid gap-2">
        <Label htmlFor="betting-numeric">Your answer</Label>
        <Input
          id="betting-numeric"
          inputMode="decimal"
          placeholder="A number, or a fraction like 5/16"
          value={value.numericText ?? ""}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, numericText: event.target.value })}
        />
      </div>
    );
  }

  const family = (value.family || "") as DistributionFamily | "";
  const fields = family ? FAMILY_FIELDS[family] : [];

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        <Label htmlFor="betting-family">Distribution family</Label>
        <select
          id="betting-family"
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
          value={family}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...value,
              family: event.target.value as DistributionFamily,
              params: {},
            })
          }
        >
          <option value="">Choose a family</option>
          {DISTRIBUTION_FAMILIES.map((item) => (
            <option key={item} value={item}>
              {FAMILY_LABELS[item]}
            </option>
          ))}
        </select>
      </div>
      {fields.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.key} className="grid gap-2">
              <Label htmlFor={`param-${field.key}`}>{field.label}</Label>
              <Input
                id={`param-${field.key}`}
                placeholder={field.kind === "n-or-number" ? "n, or a number" : "Number or fraction"}
                value={value.params?.[field.key] ?? ""}
                disabled={disabled}
                onChange={(event) =>
                  onChange({
                    ...value,
                    params: { ...value.params, [field.key]: event.target.value },
                  })
                }
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function BetField(props: {
  bet: string;
  onChange: (next: string) => void;
  maxBet: number;
  multiplierLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <Label htmlFor="betting-bet">Bet (0 to {Math.floor(props.maxBet)})</Label>
        <p className="text-sm font-medium text-amber-100">
          This question pays <span className="font-mono">{props.multiplierLabel}</span> if you are
          right. Wrong answers lose the bet.
        </p>
      </div>
      <Input
        id="betting-bet"
        type="number"
        min={0}
        max={props.maxBet}
        step="1"
        value={props.bet}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </div>
  );
}
