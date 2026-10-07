"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimerBar } from "@/components/game/panels";
import { useBettingState, useCountdown } from "@/hooks/use-betting";
import { maxAllowedBet, type PlayerAnswer } from "@/lib/betting";
import { loadBettingPlayerSession, saveBettingPlayerSession } from "@/lib/session";
import { AnswerFields, BetField } from "./answer-fields";
import { BettingLeaderboard, formatMoney } from "./leaderboard";
import { QuestionPrompt } from "./question-prompt";

export function BettingPlayerApp(props: { code: string }) {
  const code = props.code.toUpperCase();
  const [session, setSession] = useState(() =>
    typeof window === "undefined" ? null : loadBettingPlayerSession(code)
  );
  const [name, setName] = useState(session?.name ?? "");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [answer, setAnswer] = useState<PlayerAnswer>({});
  const [bet, setBet] = useState("0");
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { state, error, loading, connected, refresh, setState } = useBettingState({
    code,
    playerId: session?.playerId,
    token: session?.token,
    enabled: Boolean(session),
  });
  const remaining = useCountdown(
    state?.current?.deadline,
    state?.current?.remainingMs,
    state?.current?.paused
  );

  async function join(event?: React.FormEvent | React.MouseEvent) {
    event?.preventDefault();
    if (joining) return;
    setJoining(true);
    setJoinError(null);
    try {
      const response = await fetch(`/api/betting/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          playerId: session?.playerId,
          token: session?.token,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not join that room.");
      const next = { playerId: data.playerId, token: data.token, name: data.name };
      saveBettingPlayerSession(code, next);
      setSession(next);
      setState(data.state);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Could not join.");
    } finally {
      setJoining(false);
    }
  }

  async function lockIn() {
    if (!session || !state?.current) return;
    setBusy(true);
    setSubmitError(null);
    try {
      const response = await fetch(`/api/betting/rooms/${code}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: session.playerId,
          token: session.token,
          bet: Number(bet) || 0,
          answer,
          confirm: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not lock in.");
      setState(data);
      await refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not lock in.");
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-6">
        <p className="text-xs tracking-wide text-amber-200/80 uppercase">
          Question betting · Room {code}
        </p>
        <h1 className="text-2xl font-semibold">Join as a group</h1>
        <form className="space-y-3" onSubmit={(event) => void join(event)}>
          <div className="grid gap-2">
            <Label htmlFor="group-name">Group name</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Table 3"
            />
          </div>
          {joinError ? <p className="text-sm text-destructive">{joinError}</p> : null}
          <Button type="submit" disabled={joining || name.trim().length < 1} className="w-full">
            {joining ? "Joining…" : "Join room"}
          </Button>
        </form>
      </div>
    );
  }

  if (loading && !state) {
    return <p className="p-6 text-muted-foreground">Loading the room…</p>;
  }
  if (error || !state) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertTitle>Could not load this room</AlertTitle>
        <AlertDescription>{error ?? "Check the code and try again."}</AlertDescription>
      </Alert>
    );
  }

  const current = state.current;
  const maxBet = maxAllowedBet(state.you?.balance ?? 0);
  const locked = Boolean(state.you?.confirmed);
  const choosing = current?.phase === "choosing" && !current.paused && state.status === "playing";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 pb-16">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-wide text-amber-200/80 uppercase">
            Question betting · {state.you?.name} · Room {code}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Balance {formatMoney(state.you?.balance ?? 0)}
          </h1>
        </div>
        <Link href="/betting">
          <Button variant="ghost">Betting home</Button>
        </Link>
      </header>

      {!connected ? (
        <Alert>
          <AlertTitle>Reconnecting</AlertTitle>
          <AlertDescription>Live updates paused briefly.</AlertDescription>
        </Alert>
      ) : null}

      {state.status === "lobby" || !current ? (
        <Card>
          <CardHeader>
            <CardTitle>Waiting for the host</CardTitle>
            <CardDescription>
              The teacher will open a question. Each item shows its payout multiplier before anyone
              bets.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {current ? (
        <Card>
          <CardHeader>
            <QuestionPrompt question={current} />
          </CardHeader>
          <CardContent className="space-y-4">
            {current.phase === "choosing" ? (
              <>
                <TimerBar
                  remainingMs={remaining}
                  totalMs={state.config.decisionTimeSeconds * 1000}
                  paused={current.paused}
                  label="Time to lock in"
                />
                {locked ? (
                  <p className="text-sm text-muted-foreground">
                    Locked in with a bet of {formatMoney(state.you?.bet ?? 0)}. Waiting for the host
                    to reveal. This question still pays {current.multiplierLabel}.
                  </p>
                ) : (
                  <>
                    <AnswerFields
                      kind={current.kind}
                      value={answer}
                      onChange={setAnswer}
                      disabled={!choosing || busy}
                    />
                    <BetField
                      bet={bet}
                      onChange={setBet}
                      maxBet={maxBet}
                      multiplierLabel={current.multiplierLabel}
                      disabled={!choosing || busy}
                    />
                    {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
                    <Button disabled={!choosing || busy} onClick={() => void lockIn()}>
                      {busy ? "Locking in…" : "Lock in"}
                    </Button>
                  </>
                )}
              </>
            ) : (
              <RevealedPanel
                youId={state.you?.id}
                multiplierLabel={current.multiplierLabel}
                revealed={current.revealed}
              />
            )}
          </CardContent>
        </Card>
      ) : null}

      <BettingLeaderboard rows={state.leaderboard} highlightId={state.you?.id} />
    </div>
  );
}

function RevealedPanel(props: {
  youId?: string;
  multiplierLabel: string;
  revealed: {
    correctKey: string;
    results: Array<{
      playerId: string;
      correct: boolean;
      bet: number;
      delta: number;
      missed: boolean;
    }>;
  } | null;
}) {
  const yours = props.revealed?.results.find((row) => row.playerId === props.youId);
  return (
    <div className="space-y-3 text-sm">
      <p>
        This question paid <span className="font-mono font-semibold">{props.multiplierLabel}</span>.
        Key: <span className="font-medium">{props.revealed?.correctKey}</span>
      </p>
      {yours?.missed ? (
        <p className="text-muted-foreground">No lock-in, so your balance did not change.</p>
      ) : yours ? (
        <p>
          {yours.correct ? "Correct." : "Incorrect."} Bet {formatMoney(yours.bet)}, change{" "}
          {yours.delta >= 0 ? "+" : ""}
          {formatMoney(yours.delta)}.
        </p>
      ) : null}
    </div>
  );
}
