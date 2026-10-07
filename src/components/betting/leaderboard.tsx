import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function BettingLeaderboard(props: {
  rows: Array<{ id: string; name: string; balance: number }>;
  title?: string;
  highlightId?: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.title ?? "Live leaderboard"}</CardTitle>
        <CardDescription>Balances, highest first. Updated as soon as a question is revealed or the host adjusts points.</CardDescription>
      </CardHeader>
      <CardContent>
        {props.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No groups yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.rows.map((row, index) => (
                <TableRow
                  key={row.id}
                  className={row.id === props.highlightId ? "bg-amber-200/10" : undefined}
                >
                  <TableCell>
                    {index + 1}. {row.name}
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatMoney(row.balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function QuestionList(props: {
  items: Array<{
    id: number;
    multiplierLabel: string;
    prompt: string;
    status?: string;
  }>;
  currentId?: number | null;
  onPick?: (id: number) => void;
  showStatus?: boolean;
}) {
  return (
    <ol className="space-y-2">
      {props.items.map((item) => {
        const current = item.id === props.currentId;
        return (
          <li key={item.id}>
            <button
              type="button"
              disabled={!props.onPick}
              onClick={() => props.onPick?.(item.id)}
              className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left text-sm ${
                current ? "border-amber-300/60 bg-amber-200/10" : "border-border bg-card"
              } ${props.onPick ? "hover:bg-muted/40" : ""}`}
            >
              <span className="w-6 shrink-0 font-mono text-muted-foreground">{item.id}.</span>
              <span className="inline-flex shrink-0 rounded bg-amber-200 px-1.5 py-0.5 font-mono text-xs font-semibold text-zinc-950">
                {item.multiplierLabel}
              </span>
              <span className="min-w-0 flex-1 text-pretty">
                {item.prompt}
                {props.showStatus && item.status ? (
                  <span className="ml-2 text-xs text-muted-foreground">({item.status})</span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
