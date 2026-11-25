"use client";

import { useEffect } from "react";
import { install } from "@/lib/sakuga";

/** Mounted once in the root layout: wires every control on every page to lib/sakuga. Renders nothing. */
export function SakugaFx() {
  useEffect(() => install(), []);
  return null;
}
