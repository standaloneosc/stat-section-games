import { createPracticeRound, resolvePractice, type PatternChoice } from "@/lib/coin-race";
import { jsonError, noStore } from "@/lib/game/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: "new" | "resolve";
      bayesMode?: "off" | "everyRound";
      practiceId?: string;
      chosenPattern?: PatternChoice;
      estimatedWinPercent?: number;
      bayesPercent?: number | null;
      confirm?: boolean;
    };
    if (body.action === "resolve" || body.practiceId) {
      const state = resolvePractice({
        practiceId: body.practiceId ?? "",
        chosenPattern: body.chosenPattern ?? "A",
        estimatedWinProbability: (body.estimatedWinPercent ?? 0) / 100,
        bayesEstimate: typeof body.bayesPercent === "number" ? body.bayesPercent / 100 : null,
        confirm: body.confirm ?? true,
      });
      return Response.json(state, { headers: noStore });
    }
    const created = createPracticeRound({
      bayesMode: body.bayesMode === "everyRound" ? "everyRound" : "off",
    });
    return Response.json(created, { headers: noStore });
  } catch (error) {
    return jsonError(error);
  }
}
