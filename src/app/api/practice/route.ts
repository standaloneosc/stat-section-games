import { createPracticeRound, resolvePractice } from "@/lib/game";
import { jsonError, noStore } from "@/lib/game/http";
import type { MonsterTrait } from "@/lib/probability";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      hintsEnabled?: boolean;
      bayes?: boolean;
      trait?: MonsterTrait | "auto";
      priorNoticed?: number;
      warningLikelihoodIfNoticed?: number;
      warningLikelihoodIfNotNoticed?: number;
      practiceId?: string;
      selectedSquare?: string;
      estimatedHitPercent?: number;
      bayesPercent?: number | null;
      confirm?: boolean;
      action?: "new" | "resolve";
    };
    if (body.action === "resolve" || body.practiceId) {
      const state = resolvePractice({
        practiceId: body.practiceId ?? "",
        selectedSquare: body.selectedSquare ?? "",
        estimatedHitProbability: (body.estimatedHitPercent ?? 0) / 100,
        bayesEstimate:
          typeof body.bayesPercent === "number" ? body.bayesPercent / 100 : null,
        confirm: body.confirm ?? true,
      });
      return Response.json(state, { headers: noStore });
    }
    const created = createPracticeRound({
      hintsEnabled: body.hintsEnabled,
      bayes: body.bayes,
      trait: body.trait,
      priorNoticed: body.priorNoticed,
      warningLikelihoodIfNoticed: body.warningLikelihoodIfNoticed,
      warningLikelihoodIfNotNoticed: body.warningLikelihoodIfNotNoticed,
    });
    return Response.json(created, { headers: noStore });
  } catch (error) {
    return jsonError(error);
  }
}
