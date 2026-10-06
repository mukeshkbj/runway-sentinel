"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { AirfieldMap } from "./MapClient";

const Inner = dynamic(() => import("./MapClient").then((m) => m.AirfieldMap), {
  ssr: false,
  loading: () => <div className="flex h-[420px] items-center justify-center text-sm text-zinc-500">Loading airfield map…</div>,
});

export function Map(props: ComponentProps<typeof AirfieldMap>) {
  return <Inner {...props} />;
}
