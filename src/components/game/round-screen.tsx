"use client";

import { useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PublicRoomState } from "@/lib/game";
import {
  buildBayesWorksheet,
  defaultExplanationSquare,
  formatPercent,
  formatPosition,
} from "@/lib/probability";
import { GameBoard, squareLabel, traitLabel } from "./board";
import { HelpPanel, MovementTable, TimerBar } from "./panels";

export function RoundScreen(props: {
  state: PublicRoomState;
  onSubmit?: (input: {
    selectedSquare: string;
    estimatedHitPercent: number;
    bayesPercent: number | null;
    confirm: boolean;
  }) => Promise<void>;
  submitting?: boolean;
  readOnly?: boolean;
  practice?: boolean;
}) {
  const round = props.state.round;
  const you = props.state.you;
  const [selected, setSelected] = useState(you?.selectedSquare ?? "");
  const [hitPercent, setHitPercent] = useState(
    you?.estimatedHitProbability !== null && you?.estimatedHitProbability !== undefined
      ? String(roundToTenths((you.estimatedHitProbability ?? 0) * 100))
      : ""
  );
  const [bayesPercent, setBayesPercent] = useState(
    you?.bayesEstimate !== null && you?.bayesEstimate !== undefined
      ? String(roundToTenths((you.bayesEstimate ?? 0) * 100))
      : ""
  );
  const [formError, setFormError] = useState<string | null>(null);

  const remaining = round?.remainingMs ?? 0;
  const total = (props.state.config.roundDurationSeconds ?? 240) * 1000;
  const choosing = round?.phase === "choosing";
  const locked = !choosing || props.readOnly;

  const selectedLabel = selected ? squareLabel(selected) : "none yet";
  const bayes = Boolean(round?.bayes.enabled);
  const worksheetSquare = round
    ? defaultExplanationSquare(round.legalSquares, round.monster.currentPosition)
    : null;
  const bayesWorksheet =
    bayes && round
      ? buildBayesWorksheet({
          prior: round.bayes.priorNoticed ?? 0,
          likelihoodIfNoticed: round.bayes.clueLikelihoodIfNoticed ?? 0,
          likelihoodIfNotNoticed: round.bayes.clueLikelihoodIfNotNoticed ?? 0,
          warning: round.bayes.clueId === "warning",
        })
      : null;

  const canSubmit = useMemo(() => {
    if (!selected || locked) return false;
    const hit = Number(hitPercent);
    if (!Number.isFinite(hit) || hit < 0 || hit > 100) return false;
    if (bayes) {
      const posterior = Number(bayesPercent);
      if (!Number.isFinite(posterior) || posterior < 0 || posterior > 100) return false;
    }
    return true;
  }, [selected, hitPercent, bayesPercent, bayes, locked]);

  if (!round) {
    return (
      <Alert>
        <AlertTitle>Waiting for the host</AlertTitle>
        <AlertDescription>
          The board will appear when the host starts round 1. Keep this tab open.
        </AlertDescription>
      </Alert>
    );
  }

  async function handleSubmit() {
    setFormError(null);
    if (!props.onSubmit) return;
    const hit = Number(hitPercent);
    if (!selected) {
      setFormError("Select a highlighted legal square first.");
      return;
    }
    if (!Number.isFinite(hit) || hit < 0 || hit > 100) {
      setFormError("Enter a hit probability between 0 and 100.");
      return;
    }
    if (bayes) {
      const posterior = Number(bayesPercent);
      if (!Number.isFinite(posterior) || posterior < 0 || posterior > 100) {
        setFormError("Enter P(noticed | clue) between 0 and 100.");
        return;
      }
    }
    try {
      await props.onSubmit({
        selectedSquare: selected,
        estimatedHitPercent: hit,
        bayesPercent: bayes ? Number(bayesPercent) : null,
        confirm: true,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not submit.");
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs tracking-wide text-muted-foreground uppercase">
              Round {round.roundNumber} of {props.state.config.roundCount}
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">
              {traitLabel(round.monster.trait)} on {formatPosition(round.monster.currentPosition)}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{traitLabel(round.monster.trait)}</Badge>
            {bayes ? <Badge variant="secondary">Bayes challenge</Badge> : <Badge variant="outline">LOTP round</Badge>}
            {you ? <Badge variant="outline">Score {you.score}</Badge> : null}
          </div>
        </div>

        {!props.practice ? (
          <TimerBar
            remainingMs={remaining}
            totalMs={round.phase === "results" ? props.state.config.resultsDurationSeconds * 1000 : total}
            paused={round.paused}
            label={round.phase === "results" ? "Results on screen" : "Time to calculate and submit"}
          />
        ) : null}

        {remaining <= 20_000 && choosing && !round.paused ? (
          <Alert variant="destructive">
            <AlertTitle>Last 20 seconds</AlertTitle>
            <AlertDescription>
              Lock in a square and a probability. If you miss it, the server assigns a random legal square and marks you as late.
            </AlertDescription>
          </Alert>
        ) : null}

        <GameBoard
          monsterTrait={round.monster.trait}
          currentPosition={round.monster.currentPosition}
          legalSquares={round.legalSquares}
          selectedSquare={selected || you?.selectedSquare || null}
          destination={round.resolved?.destination ?? null}
          playerCounts={round.resolved?.playerCounts ?? null}
          hints={round.hints}
          resolved={round.phase === "results"}
          disabled={locked}
          onSelect={setSelected}
        />
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Monster trait</CardTitle>
            <CardDescription>{round.monster.description}</CardDescription>
          </CardHeader>
        </Card>

        {bayes && bayesWorksheet ? (
          <Card className="border-amber-300/30">
            <CardHeader>
              <CardTitle>Clue — update P(noticed)</CardTitle>
              <CardDescription>{round.bayes.clueText}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-6">
              <p>
                Before the clue, P(noticed) = {formatPercent(round.bayes.priorNoticed ?? 0)} and
                P(not noticed) = {formatPercent(1 - (round.bayes.priorNoticed ?? 0))}. That prior is
                not the mix weight after you see the clue.
              </p>
              <p>
                P(clue | noticed) ={" "}
                {formatPercent(
                  round.bayes.clueId === "warning"
                    ? (round.bayes.clueLikelihoodIfNoticed ?? 0)
                    : 1 - (round.bayes.clueLikelihoodIfNoticed ?? 0)
                )}
                . P(clue | not noticed) ={" "}
                {formatPercent(
                  round.bayes.clueId === "warning"
                    ? (round.bayes.clueLikelihoodIfNotNoticed ?? 0)
                    : 1 - (round.bayes.clueLikelihoodIfNotNoticed ?? 0)
                )}
                .
              </p>
              <p className="rounded-lg bg-amber-500/10 px-3 py-2 font-mono leading-6">
                {bayesWorksheet.evidenceLine}
                <br />
                {bayesWorksheet.posteriorLine}
              </p>
              <p className="text-muted-foreground">{bayesWorksheet.mixHint}</p>
            </CardContent>
          </Card>
        ) : null}

        <MovementTable
          modes={round.monster.movementModes}
          legalSquares={round.legalSquares}
          bayes={bayes}
          worksheetSquare={bayes ? null : worksheetSquare}
        />

        <Card>
          <CardHeader>
            <CardTitle>Your hide</CardTitle>
            <CardDescription>
              Selected square: {selectedLabel}. Enter percents, not decimals — type 45 for 45%.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {you?.confirmed ? (
              <Alert>
                <AlertTitle>Choice locked in</AlertTitle>
                <AlertDescription>
                  You can still change it until the timer ends.
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="hit">Estimated hit probability for your square (%)</Label>
              <Input
                id="hit"
                inputMode="decimal"
                placeholder="45"
                value={hitPercent}
                disabled={locked}
                onChange={(event) => setHitPercent(event.target.value)}
              />
            </div>
            {bayes ? (
              <div className="space-y-2">
                <Label htmlFor="bayes">P(noticed | clue) (%)</Label>
                <Input
                  id="bayes"
                  inputMode="decimal"
                  placeholder="75"
                  value={bayesPercent}
                  disabled={locked}
                  onChange={(event) => setBayesPercent(event.target.value)}
                />
              </div>
            ) : null}
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
            <Button
              className="w-full"
              disabled={!canSubmit || props.submitting || locked}
              onClick={() => void handleSubmit()}
            >
              {props.submitting ? "Submitting…" : you?.confirmed ? "Update my choice" : "Lock in my choice"}
            </Button>
            {round.hints ? (
              <p className="text-xs text-amber-200">
                Hints are on. Each legal square shows its true hit probability.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <HelpPanel />
      </div>
    </div>
  );
}

function roundToTenths(value: number): number {
  return Math.round(value * 10) / 10;
}
