"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { maxAllowedBet, type PlayerAnswer, type PublicGridItem, type PublicQuestionInfo } from "@/lib/betting";
import { AnswerFields, BetField } from "./answer-fields";
import { formatMoney } from "./leaderboard";
import { QuestionGrid } from "./question-grid";
import { QuestionPrompt } from "./question-prompt";

type PracticeState = {
  practiceId: string;
  balance: number;
  catalog: PublicQuestionInfo[];
  grid: PublicGridItem[];
};

export function BettingPracticeApp() {
  const [state, setState] = useState<PracticeState | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [answer, setAnswer] = useState<PlayerAnswer>({});
  const [bet, setBet] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ensureSession() {
    if (state) return state;
    const response = await fetch("/api/betting/practice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "new" }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not start practice.");
    setState(data);
    return data as PracticeState;
  }

  useEffect(() => {
    void ensureSession().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not start practice.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pick(id: number) {
    setSelectedId(id);
    setAnswer({});
    setBet("0");
    setError(null);
  }

  async function lockIn(item: PublicGridItem) {
    setBusy(true);
    setError(null);
    try {
      const session = await ensureSession();
      const response = await fetch("/api/betting/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve",
          practiceId: session.practiceId,
          questionId: item.id,
          bet: Number(bet) || 0,
          answer,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not grade that.");
      setState(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not grade.");
    } finally {
      setBusy(false);
    }
  }

  const selected = state?.grid.find((item) => item.id === selectedId) ?? null;
  const maxBet = maxAllowedBet(state?.balance ?? 10_000);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 pb-16">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-wide text-amber-200/80 uppercase">Practice · Question betting</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Untimed grid · {formatMoney(state?.balance ?? 10_000)}
          </h1>
          <p className="text-sm text-muted-foreground">
            Pick any cell. Each shows its multiplier before you bet. One lock-in per question.
          </p>
        </div>
        <Link href="/betting">
          <Button variant="ghost">Home</Button>
        </Link>
      </header>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {state ? (
        <QuestionGrid items={state.grid} selectedId={selectedId} onSelect={pick} />
      ) : (
        <p className="text-sm text-muted-foreground">Loading the bank…</p>
      )}

      {selected ? (
        <Card>
          <CardHeader>
            <QuestionPrompt question={selected} />
          </CardHeader>
          <CardContent className="space-y-4">
            {selected.yourResult ? (
              <div className="space-y-1 text-sm">
                <p>
                  {selected.yourResult.correct ? "Correct." : "Incorrect."} Paid{" "}
                  <span className="font-mono font-semibold">{selected.multiplierLabel}</span>. Key:{" "}
                  {selected.yourResult.correctKey}
                </p>
                <p>
                  Bet {formatMoney(selected.yourResult.bet)}, change{" "}
                  {selected.yourResult.delta >= 0 ? "+" : ""}
                  {formatMoney(selected.yourResult.delta)}.
                </p>
              </div>
            ) : (
              <>
                <AnswerFields kind={selected.kind} value={answer} onChange={setAnswer} disabled={busy} />
                <BetField
                  bet={bet}
                  onChange={setBet}
                  maxBet={maxBet}
                  multiplierLabel={selected.multiplierLabel}
                  disabled={busy}
                />
                <Button disabled={busy} onClick={() => void lockIn(selected)}>
                  {busy ? "Grading…" : "Lock in"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
