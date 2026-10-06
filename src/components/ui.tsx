import type { CheckStatus } from "@/lib/types";

export function Badge({ tone, children }: { tone: CheckStatus | "info"; children: React.ReactNode }) {
  const styles: Record<string, string> = {
    pass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    warn: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    fail: "bg-red-500/15 text-red-300 border-red-500/30",
    info: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  };
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${styles[tone]}`}>{children}</span>;
}

export function DecisionBadge({ decision }: { decision: "GO" | "CAUTION" | "NO-GO" }) {
  const map = { GO: "pass", CAUTION: "warn", "NO-GO": "fail" } as const;
  return (
    <Badge tone={map[decision]}>
      <span className="font-mono font-bold tracking-wider">{decision}</span>
    </Badge>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-500";

export const btnCls =
  "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors";
export const btnPrimary = `${btnCls} bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-40 disabled:hover:bg-sky-600`;
export const btnGhost = `${btnCls} border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-40`;
