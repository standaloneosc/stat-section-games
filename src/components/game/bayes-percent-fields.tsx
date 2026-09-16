"use client";

import { Input } from "@/components/ui/input";
import {
  DEFAULT_ALERT_PERCENT,
  DEFAULT_WARNING_GIVEN_ALERT_PERCENT,
  DEFAULT_WARNING_GIVEN_CALM_PERCENT,
} from "@/lib/game/bayes-percents";

export type BayesPercentValues = {
  priorPercent: number;
  warningIfAlertPercent: number;
  warningIfCalmPercent: number;
};

export const DEFAULT_BAYES_PERCENTS: BayesPercentValues = {
  priorPercent: DEFAULT_ALERT_PERCENT,
  warningIfAlertPercent: DEFAULT_WARNING_GIVEN_ALERT_PERCENT,
  warningIfCalmPercent: DEFAULT_WARNING_GIVEN_CALM_PERCENT,
};

export function BayesPercentFields(props: {
  values: BayesPercentValues;
  onChange: (values: BayesPercentValues) => void;
  disabled?: boolean;
  error?: string | null;
}) {
  const quietIfAlert = clampDisplayPercent(100 - props.values.warningIfAlertPercent);
  const quietIfCalm = clampDisplayPercent(100 - props.values.warningIfCalmPercent);

  return (
    <div className="grid gap-3 rounded-lg border border-border p-3 sm:col-span-2 lg:col-span-3 sm:grid-cols-3">
      <p className="text-sm font-medium sm:col-span-3">Alert percents for this round</p>
      <p className="text-muted-foreground text-sm leading-6 sm:col-span-3">
        Defaults are {DEFAULT_ALERT_PERCENT}% / {DEFAULT_WARNING_GIVEN_ALERT_PERCENT}% /{" "}
        {DEFAULT_WARNING_GIVEN_CALM_PERCENT}%. Students see these numbers in the facts box — not the
        posterior.
      </p>
      <label className="grid gap-2 text-sm">
        P(Alert)
        <Input
          type="number"
          min={0}
          max={100}
          step={1}
          disabled={props.disabled}
          value={props.values.priorPercent}
          onChange={(event) =>
            props.onChange({
              ...props.values,
              priorPercent: Number(event.target.value),
            })
          }
        />
        <span className="text-muted-foreground text-xs leading-5">
          Notices the class before any clue.
        </span>
      </label>
      <label className="grid gap-2 text-sm">
        P(warning | Alert)
        <Input
          type="number"
          min={0}
          max={100}
          step={1}
          disabled={props.disabled}
          value={props.values.warningIfAlertPercent}
          onChange={(event) =>
            props.onChange({
              ...props.values,
              warningIfAlertPercent: Number(event.target.value),
            })
          }
        />
        <span className="text-muted-foreground text-xs leading-5">
          Light on if Alert. Quiet | Alert = {quietIfAlert}%.
        </span>
      </label>
      <label className="grid gap-2 text-sm">
        P(warning | Calm)
        <Input
          type="number"
          min={0}
          max={100}
          step={1}
          disabled={props.disabled}
          value={props.values.warningIfCalmPercent}
          onChange={(event) =>
            props.onChange({
              ...props.values,
              warningIfCalmPercent: Number(event.target.value),
            })
          }
        />
        <span className="text-muted-foreground text-xs leading-5">
          Light on if Calm. Quiet | Calm = {quietIfCalm}%.
        </span>
      </label>
      {props.error ? (
        <p className="text-destructive text-sm sm:col-span-3">{props.error}</p>
      ) : null}
    </div>
  );
}

function clampDisplayPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
}
