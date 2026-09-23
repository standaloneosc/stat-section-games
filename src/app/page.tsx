import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-4 py-10">
      <header className="space-y-3">
        <p className="text-xs tracking-[0.2em] text-amber-200/80 uppercase">Classroom probability</p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Stat section games
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Two local-multiplayer games for a probability classroom. No accounts. Create a room on
          the teacher laptop, then join from student tabs.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hide &amp; Seek</CardTitle>
            <CardDescription>
              A 3×3 board, one monster, LOTP and Bayes. Survival points split with anyone who hid
              on the same square.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/hide-and-seek">
              <Button>Open hide-and-seek</Button>
            </Link>
            <Link href="/practice">
              <Button variant="secondary">Practice</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Coin Pattern Race</CardTitle>
            <CardDescription>
              HHT vs THT and friends. Students pick which pattern appears first and estimate the
              suffix-state probability — not the next three flips.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/coin-race">
              <Button>Open coin pattern race</Button>
            </Link>
            <Link href="/coin-race/practice">
              <Button variant="secondary">Practice</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
