import type { PublicQuestionInfo } from "@/lib/betting";
import { MultiplierBadge } from "./multiplier-badge";

export function QuestionPrompt(props: {
  question: Pick<PublicQuestionInfo, "id" | "multiplier" | "multiplierLabel" | "prompt" | "kind">;
  eyebrow?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs tracking-wide text-amber-200/80 uppercase">
          {props.eyebrow ?? `Question ${props.question.id} of 15`}
        </p>
        <MultiplierBadge
          multiplier={props.question.multiplier}
          label={props.question.multiplierLabel}
          size="lg"
        />
      </div>
      <p className="text-lg leading-8 text-pretty sm:text-xl">{props.question.prompt}</p>
    </div>
  );
}
