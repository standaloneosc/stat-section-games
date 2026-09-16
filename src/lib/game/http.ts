import { NextResponse } from "next/server";
import { GameError } from "@/lib/game";

export function jsonError(error: unknown) {
  if (error instanceof GameError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}

export const noStore = {
  "Cache-Control": "no-store",
};
