"use client";

import { useState } from "react";
import { StatusPanel } from "./StatusPanel";
import { LogViewer } from "./LogViewer";
import { ConfigEditor } from "./ConfigEditor";
import { PointsTool } from "./PointsTool";

type Tab = "status" | "logs" | "config" | "points";

const TABS: { id: Tab; label: string }[] = [
  { id: "status", label: "Status" },
  { id: "logs", label: "Logs" },
  { id: "config", label: "Config" },
  { id: "points", label: "Points" },
];

/**
 * Per spec Section 14: config editor, points tool, log viewer, status
 * panel - all consuming the Task #4 backend, already built and tested.
 * Status and Logs are real in this pass; Config and Points are genuinely
 * still placeholders, built in a following pass rather than crammed in
 * alongside these to keep this batch reviewable.
 */
export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("status");

  return (
    <div className="min-h-screen bg-[#0F1923] px-6 py-12 text-[#ECE8E1]">
      <div className="mx-auto max-w-4xl">
        <h1
          className="mb-8 text-2xl tracking-[0.2em]"
          style={{ fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700 }}
        >
          ADMIN
        </h1>

        <div className="mb-6 flex gap-1 border-b border-[#34f5c5]/20">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm uppercase tracking-widest transition-colors ${
                activeTab === tab.id
                  ? "border-b-2 border-[#34f5c5] text-[#34f5c5]"
                  : "text-[#9AA3AC] hover:text-[#ECE8E1]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "status" && <StatusPanel />}
        {activeTab === "logs" && <LogViewer />}
        {activeTab === "config" && <ConfigEditor />}
        {activeTab === "points" && <PointsTool />}
      </div>
    </div>
  );
}
