"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { actions, useOps } from "@/lib/store";

const links = [
  { href: "/", label: "Ops" },
  { href: "/plan", label: "New mission" },
  { href: "/fleet", label: "Fleet" },
  { href: "/work-orders", label: "Work orders" },
];

export function Nav() {
  const pathname = usePathname();
  const { missions, workOrders } = useOps();
  const open = workOrders.filter((w) => w.status !== "resolved").length;
  const active = missions.filter((m) => m.status === "in-progress").length;
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-500/20 font-mono text-sm font-bold text-sky-300">
            RS
          </span>
          <span className="font-mono text-sm font-semibold tracking-widest text-zinc-100">
            RUNWAY SENTINEL <span className="text-zinc-500">· KBOS</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-1.5 text-sm ${
                (l.href === "/" ? pathname === "/" : pathname.startsWith(l.href))
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {l.label}
              {l.label === "Work orders" && open > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 text-xs text-amber-300">{open}</span>
              )}
              {l.label === "New mission" && active > 0 && (
                <span className="ml-1.5 rounded-full bg-emerald-500/20 px-1.5 text-xs text-emerald-300">{active}</span>
              )}
            </Link>
          ))}
        </nav>
        <button
          onClick={() => actions.reset()}
          className="ml-auto text-xs text-zinc-600 hover:text-zinc-400"
          title="Reset demo data"
        >
          reset demo
        </button>
      </div>
    </header>
  );
}
