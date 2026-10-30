"use client";

import { useEffect, useState } from "react";
import { StatusPanel } from "./StatusPanel";
import { LogViewer } from "./LogViewer";
import { ConfigEditor } from "./ConfigEditor";
import { PointsTool } from "./PointsTool";
import { AgentPicker } from "./AgentPicker";
import { BreakControl } from "./BreakControl";
import { Ransom } from "../Hero";

type Tab = "status" | "break" | "agent" | "points" | "logs" | "config";

/**
 * Channels, ordered by how often they're reached for mid-stream: the wall,
 * then the two things set between rounds (break, agent), then the desk
 * tools. Numbered because the number is how you find it again, not
 * decoration.
 */
const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "status", label: "Status", hint: "The wall" },
  { id: "break", label: "Break", hint: "BRB timer" },
  { id: "agent", label: "Agent", hint: "Ability reserve" },
  { id: "points", label: "Points", hint: "Balance, grant" },
  { id: "logs", label: "Logs", hint: "Backend output" },
  { id: "config", label: "Config", hint: "Settings, accounts" },
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
      <header className="wallpaper relative flex items-center justify-between gap-4 border-b-4 border-ink px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl">
            <Ransom text="DualBladeX" />
          </h1>
          <span className="tag hidden bg-ink text-sm text-phosphor sm:inline-block">Control room</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/editor" className="menu-pop label px-2 py-1 text-xs hover:bg-ink hover:text-phosphor">
            Editor app
          </a>
          <p className="osd flex items-center gap-2 bg-ink px-2 py-0.5 text-xl tabular-nums text-phosphor">
            {clock || " "}
          </p>
          <form method="post" action="/auth/logout">
            <button
              type="submit"
              className="menu-pop label whitespace-nowrap border-2 border-ink px-3 py-1.5 text-xs text-ink hover:bg-ink hover:text-phosphor"
            >
              Log out
            </button>
          </form>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <nav
          aria-label="Dashboard sections"
          className="sticky top-0 z-20 flex gap-2 overflow-x-auto border-b-2 border-phosphor bg-ink px-3 py-3 lg:h-screen lg:self-start lg:w-60 lg:shrink-0 lg:flex-col lg:gap-1.5 lg:overflow-visible lg:border-b-0 lg:border-r-2 lg:px-4 lg:py-6"
        >
          {TABS.map((tab, i) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => setActiveTab(tab.id)}
                className={`menu-pop flex shrink-0 items-center gap-3 px-3 py-2 text-left lg:py-2.5 ${
                  active ? "menu-on" : "text-phosphor hover:bg-field hover:text-ink [&:hover_span]:text-ink"
                }`}
              >
                {/* The channel number keeps its old accessible name (CH1...); the 01 is how it looks. */}
                <span className="sr-only">CH{i + 1}</span>
                <span aria-hidden className={`osd text-2xl ${active ? "text-field-deep" : "text-field"}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex flex-col">
                  <span className="label text-sm">{tab.label}</span>
                  <span className={`hidden text-xs lg:block ${active ? "text-ink/75" : "text-dim"}`}>
                    {tab.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        <main key={activeTab} className="crt-on wipe min-w-0 flex-1 px-3 py-5 sm:px-6 lg:px-8 lg:py-8">
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
