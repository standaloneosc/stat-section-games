"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Something broke on this page</h1>
      <p className="text-sm text-muted-foreground">
        The game state is still on the server. Reload, or go home and rejoin with the same name and room code.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Link href="/">
          <Button variant="outline">Home</Button>
        </Link>
      </div>
    </div>
  );
}
