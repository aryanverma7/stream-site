"use client";

import { useEffect, useState } from "react";
import { StatusPanel } from "./StatusPanel";
import { LogViewer } from "./LogViewer";
import { ConfigEditor } from "./ConfigEditor";
import { PointsTool } from "./PointsTool";
import { AgentPicker } from "./AgentPicker";
import { BreakControl } from "./BreakControl";

type Tab = "status" | "break" | "agent" | "points" | "logs" | "config";

/**
 * Channels, ordered by how often they're reached for mid-stream: the wall,
 * then the two things set between rounds (break, agent), then the desk
 * tools. Numbered because a monitor wall's channels are numbered - the
 * number is how you find it again, not decoration.
 */
const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "status", label: "Status", hint: "The wall" },
  { id: "break", label: "Break", hint: "BRB timer" },
  { id: "agent", label: "Agent", hint: "Ability reserve" },
  { id: "points", label: "Points", hint: "Balance, grant" },
  { id: "logs", label: "Logs", hint: "Backend output" },
  { id: "config", label: "Config", hint: "Raw JSON, accounts" },
];

function useClock(): string {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString([], { hour12: false }));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/**
 * The control room. Status is the wall of feeds; Break drives the "be
 * right back" overlay and is set before switching to that scene; Agent
 * sets the credits the roulette reserves for abilities.
 */
export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("status");
  const clock = useClock();

  return (
    <div className="flex min-h-screen flex-col bg-ink text-phosphor">
      <header className="wallpaper flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-baseline gap-3">
          <h1 className="stencil text-3xl">DualBladeX</h1>
          <span className="osd hidden text-xl sm:inline">Control room</span>
        </div>
        <p className="osd flex items-center gap-2 text-xl tabular-nums">
          {clock || " "}
        </p>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <nav
          aria-label="Dashboard sections"
          className="sticky top-0 z-20 flex gap-1 overflow-x-auto border-b border-seam bg-bezel px-2 py-2 lg:h-screen lg:self-start lg:w-56 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r lg:px-3 lg:py-4"
        >
          {TABS.map((tab, i) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => setActiveTab(tab.id)}
                className={`flex shrink-0 items-center gap-3 px-3 py-2 text-left transition-colors lg:py-2.5 ${
                  active ? "bg-field text-ink" : "text-phosphor hover:bg-bezel-2"
                }`}
              >
                <span className={`osd text-lg ${active ? "text-ink" : "text-dim"}`}>
                  CH{i + 1}
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-bold uppercase tracking-[0.08em]">{tab.label}</span>
                  <span className={`hidden text-xs lg:block ${active ? "text-ink/75" : "text-dim"}`}>
                    {tab.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        <main key={activeTab} className="crt-on min-w-0 flex-1 px-3 py-5 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-6xl">
            {activeTab === "status" && <StatusPanel />}
            {activeTab === "logs" && <LogViewer />}
            {activeTab === "config" && <ConfigEditor />}
            {activeTab === "points" && <PointsTool />}
            {activeTab === "agent" && <AgentPicker />}
            {activeTab === "break" && <BreakControl />}
          </div>
        </main>
      </div>
    </div>
  );
}
