"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveCoinRaceHostSession, saveCoinRacePlayerSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export function CoinRaceHomeApp() {
  const router = useRouter();
  const [hostName, setHostName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"host" | "join" | null>(null);
  const requestLock = useRef(false);

  async function createRoom(event?: React.FormEvent | React.MouseEvent) {
    event?.preventDefault();
    if (requestLock.current) return;
    requestLock.current = true;
    setBusy("host");
    setError(null);
    try {
      const response = await fetch("/api/coin-race/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: hostName || "Host" }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not create a room.");
      }
      saveCoinRaceHostSession(data.code, data.hostToken);
      router.push(data.hostPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create a room.");
    } finally {
      requestLock.current = false;
      setBusy(null);
    }
  }

  async function joinRoom(event?: React.FormEvent | React.MouseEvent) {
    event?.preventDefault();
    if (requestLock.current) return;
    requestLock.current = true;
    setBusy("join");
    setError(null);
    const code = joinCode.trim().toUpperCase();
    try {
      const response = await fetch(`/api/coin-race/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: joinName }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not join that room.");
      }
      saveCoinRacePlayerSession(code, {
        playerId: data.playerId,
        token: data.token,
        name: data.name,
      });
      router.push(`/coin-race/room/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join.");
    } finally {
      requestLock.current = false;
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-4 py-10">
      <header className="space-y-3">
        <p className="text-xs tracking-[0.2em] text-amber-200/80 uppercase">
          <Link href="/" className="hover:underline">
            Stat section games
          </Link>
          {" · "}Coin Pattern Race
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Which pattern appears first?
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Two target strings race on a fair coin. Overlaps matter: the answer is the probability
          that one pattern appears before the other, not the chance it shows up in the next three
          flips. Optional Bayes questions ask for P(biased coin | observed flips).
        </p>
      </header>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Host a class</CardTitle>
            <CardDescription>
              Create a room, set scoring, then start, pause, and end rounds from the teacher desk.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              method="post"
              action="/api/coin-race/rooms"
              onSubmit={(event) => void createRoom(event)}
            >
              <div className="grid gap-2">
                <Label htmlFor="cpr-host-name">Your name (optional)</Label>
                <Input
                  id="cpr-host-name"
                  name="name"
                  value={hostName}
                  placeholder="Ms. Park"
                  onChange={(event) => setHostName(event.target.value)}
                />
              </div>
              <button type="submit" className={cn(buttonVariants(), "w-full")} disabled={busy !== null}>
                {busy === "host" ? "Creating…" : "Create room"}
              </button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Join a room</CardTitle>
            <CardDescription>Use the four-character code on the board.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={(event) => void joinRoom(event)}>
              <div className="grid gap-2">
                <Label htmlFor="cpr-join-name">Display name</Label>
                <Input
                  id="cpr-join-name"
                  value={joinName}
                  placeholder="Jordan"
                  onChange={(event) => setJoinName(event.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cpr-code">Room code</Label>
                <Input
                  id="cpr-code"
                  value={joinCode}
                  placeholder="K7MP"
                  className="uppercase"
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={busy !== null || joinName.trim().length < 1 || joinCode.trim().length < 4}
              >
                {busy === "join" ? "Joining…" : "Join"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Practice alone</CardTitle>
            <CardDescription>One pattern race, scored by the server after you lock in.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Each round samples two- or three-letter patterns, sometimes with a leading H or T and
              sometimes from a blank history.
            </p>
            <Button className="w-full" variant="secondary" onClick={() => router.push("/coin-race/practice")}>
              Open practice
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
