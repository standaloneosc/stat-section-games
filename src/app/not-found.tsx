import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">That page is not on the board</h1>
      <p className="text-sm text-muted-foreground">
        Check the room code, or create a new classroom from the home page.
      </p>
      <Link href="/">
        <Button>Home</Button>
      </Link>
    </div>
  );
}
