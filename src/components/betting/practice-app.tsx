"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { maxAllowedBet, type PlayerAnswer, type PublicQuestionInfo } from "@/lib/betting";
import { AnswerFields, BetField } from "./answer-fields";
import { formatMoney, QuestionList } from "./leaderboard";
import { QuestionPrompt } from "./question-prompt";

type PracticeState = {
  practiceId: string;
  question: PublicQuestionInfo;
  catalog: PublicQuestionInfo[];
  balance: number;
  resolved: {
    correct: boolean;
    bet: number;
    delta: number;
    balanceAfter: number;
    correctKey: string;
  } | null;
};

export function BettingPracticeApp() {
  const [catalog, setCatalog] = useState<PublicQuestionInfo[]>([]);
  const [state, setState] = useState<PracticeState | null>(null);
  const [answer, setAnswer] = useState<PlayerAnswer>({});
  const [bet, setBet] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/betting/practice");
      const data = await response.json();
      setCatalog(data.catalog ?? []);
    })();
  }, []);

  async function start(questionId: number) {
    setBusy(true);
    setError(null);
    setAnswer({});
    setBet("0");
    try {
      const response = await fetch("/api/betting/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "new", questionId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not start that question.");
      setState(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start.");
    } finally {
      setBusy(false);
    }
  }

  async function lockIn() {
    if (!state) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/betting/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve",
          practiceId: state.practiceId,
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

  const question = state?.question;
  const maxBet = maxAllowedBet(state?.balance ?? 10_000);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 pb-16">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-wide text-amber-200/80 uppercase">Practice · Question betting</p>
          <h1 className="text-3xl font-semibold tracking-tight">Same bank, fake 10,000</h1>
        </div>
        <Link href="/betting">
          <Button variant="ghost">Home</Button>
        </Link>
      </header>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Question bank</CardTitle>
          <CardDescription>
            Every item shows its multiplier before you bet. Pick one, lock in an answer and a stake.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QuestionList
            items={(state?.catalog ?? catalog).map((item) => ({
              id: item.id,
              multiplierLabel: item.multiplierLabel,
              prompt: item.prompt,
            }))}
            currentId={question?.id}
            onPick={(id) => void start(id)}
          />
        </CardContent>
      </Card>

      {question ? (
        <Card>
          <CardHeader>
            <QuestionPrompt question={question} />
            <p className="text-sm text-muted-foreground">
              Practice balance {formatMoney(state?.balance ?? 10_000)}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {state?.resolved ? (
              <div className="space-y-2 text-sm">
                <p>
                  {state.resolved.correct ? "Correct." : "Incorrect."} This question paid{" "}
                  <span className="font-mono font-semibold">{question.multiplierLabel}</span>. Key:{" "}
                  {state.resolved.correctKey}
                </p>
                <p>
                  Bet {formatMoney(state.resolved.bet)}, change{" "}
                  {state.resolved.delta >= 0 ? "+" : ""}
                  {formatMoney(state.resolved.delta)}. New balance{" "}
                  {formatMoney(state.resolved.balanceAfter)}.
                </p>
                <Button variant="secondary" onClick={() => void start(question.id)} disabled={busy}>
                  Try this question again
                </Button>
              </div>
            ) : (
              <>
                <AnswerFields kind={question.kind} value={answer} onChange={setAnswer} disabled={busy} />
                <BetField
                  bet={bet}
                  onChange={setBet}
                  maxBet={maxBet}
                  multiplierLabel={question.multiplierLabel}
                  disabled={busy}
                />
                <Button disabled={busy} onClick={() => void lockIn()}>
                  {busy ? "Grading…" : "Lock in"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          Choose a question from the bank. The amber chip is the multiplier, shown before any bet.
        </p>
      )}
    </div>
  );
}
