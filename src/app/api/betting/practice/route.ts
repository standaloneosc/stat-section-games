import { createPractice, publicQuestionCatalog, resolvePractice, type PlayerAnswer } from "@/lib/betting";
import { jsonError, noStore } from "@/lib/game/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ catalog: publicQuestionCatalog() }, { headers: noStore });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: "new" | "resolve";
      questionId?: number;
      practiceId?: string;
      bet?: number;
      answer?: PlayerAnswer;
    };
    if (body.action === "resolve" || body.practiceId) {
      const state = resolvePractice({
        practiceId: body.practiceId ?? "",
        bet: body.bet ?? 0,
        answer: body.answer ?? {},
      });
      return Response.json(state, { headers: noStore });
    }
    return Response.json(createPractice(body.questionId ?? 1), { headers: noStore });
  } catch (error) {
    return jsonError(error);
  }
}
