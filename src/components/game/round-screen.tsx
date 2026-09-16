"use client";

import { useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PublicRoomState } from "@/lib/game";
import { formatPercent, formatPosition, noticedMotionBlurb } from "@/lib/probability";
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

  const prior = round.bayes.priorNoticed;
  const likeTrue = round.bayes.clueLikelihoodIfNoticed;
  const likeFalse = round.bayes.clueLikelihoodIfNotNoticed;
  const warning = round.bayes.clueId === "warning";

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
            {bayes ? <Badge variant="secondary">Notice hint</Badge> : <Badge variant="outline">LOTP round</Badge>}
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
            <CardTitle>What you do this round</CardTitle>
            <CardDescription>{round.monster.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-6">
            <p>1. Pick a highlighted legal square.</p>
            {bayes ? (
              <>
                <p>2. Use the hint to estimate P(noticed | hint).</p>
                <p>3. Mix noticed vs not-noticed movement to estimate P(hit) for your square.</p>
              </>
            ) : (
              <p>2. Add the movement modes to estimate P(hit) for your square.</p>
            )}
            <p>{bayes ? "4" : "3"}. Enter percents, not decimals — type 20 for 20%.</p>
          </CardContent>
        </Card>

        {bayes ? (
          <Card className="border-amber-300/30">
            <CardHeader>
              <CardTitle>Hint — did it notice the class?</CardTitle>
              <CardDescription>{round.bayes.clueText}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-6">
              <p>
                Before any hint, it notices the class {prior === null ? "—" : formatPercent(prior)} of
                the time.
              </p>
              <p>
                {warning
                  ? `A warning is ${likeTrue === null ? "—" : formatPercent(likeTrue)} likely if it noticed, and ${likeFalse === null ? "—" : formatPercent(likeFalse)} likely if it did not.`
                  : `Quiet sensors are ${(likeTrue === null ? "—" : formatPercent(1 - likeTrue))} likely if it noticed, and ${likeFalse === null ? "—" : formatPercent(1 - likeFalse)} likely if it did not.`}
              </p>
              <p>{noticedMotionBlurb(round.monster.trait)}</p>
              <p className="text-muted-foreground">
                Update P(noticed | this hint), then mix. The hint is not optional.
              </p>
            </CardContent>
          </Card>
        ) : null}

        <MovementTable
          modes={round.monster.movementModes}
          trait={round.monster.trait}
          bayes={bayes}
        />

        <Card>
          <CardHeader>
            <CardTitle>Your hide</CardTitle>
            <CardDescription>Selected square: {selectedLabel}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {you?.confirmed ? (
              <Alert>
                <AlertTitle>Choice locked in</AlertTitle>
                <AlertDescription>You can still change it until the timer ends.</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="hit">Your P(hit) for that square (%)</Label>
              <Input
                id="hit"
                inputMode="decimal"
                placeholder=""
                value={hitPercent}
                disabled={locked}
                onChange={(event) => setHitPercent(event.target.value)}
              />
            </div>
            {bayes ? (
              <div className="space-y-2">
                <Label htmlFor="bayes">Your P(noticed | hint) (%)</Label>
                <Input
                  id="bayes"
                  inputMode="decimal"
                  placeholder=""
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
          </CardContent>
        </Card>

        <HelpPanel bayes={bayes} />
      </div>
    </div>
  );
}

function roundToTenths(value: number): number {
  return Math.round(value * 10) / 10;
}
