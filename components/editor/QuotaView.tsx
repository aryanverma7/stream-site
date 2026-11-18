"use client";

import { useState } from "react";
import { routeHash } from "@/lib/useHashRoute";
import { daysLeft, useQuota, weekLabel, type QuotaCounts, type QuotaWeek } from "@/lib/useQuota";
import { useAsk } from "./AskDialog";

const btn = "menu-pop label border-2 border-phosphor bg-ink px-3 py-1.5 text-xs text-phosphor hover:bg-phosphor hover:text-ink disabled:opacity-40";
const field = "border-2 border-seam bg-ink px-2 py-1 text-sm focus:border-phosphor focus:outline-none";

const STATUS: Record<QuotaWeek["status"], [string, string]> = {
  met: ["Met", "bg-signal text-ink"],
  missed: ["Missed", "bg-rec text-ink"],
  excused: ["Excused", "bg-bezel-2 text-dim"],
  in_progress: ["This week", "bg-phosphor text-ink"],
};

export function StatusChip({ status }: { status: QuotaWeek["status"] }) {
  const [label, tone] = STATUS[status];
  return <span className={`label inline-block px-2 py-0.5 text-xs ${tone}`}>{label}</span>;
}

/** "1 video, 3 reels" short, or "+1 reel" extra; "" when exactly on target. */
export function gap(w: QuotaWeek): string {
  const part = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;
  const short = (["videos", "reels"] as const).filter((k) => w.short[k]).map((k) => part(w.short[k], k.slice(0, -1)));
  if (short.length) return `${short.join(", ")} short`;
  const extra = (["videos", "reels"] as const)
    .filter((k) => w.done[k] > w.target[k])
    .map((k) => `+${part(w.done[k] - w.target[k], k.slice(0, -1))}`);
  return extra.join(", ");
}

function Meter({ label, done, target }: { label: string; done: number; target: number }) {
  const pct = target ? Math.min(100, (done / target) * 100) : 100;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="label text-sm">{label}</span>
        <span className="osd text-2xl">
          {done}
          <span className="text-dim">/{target}</span>
        </span>
      </div>
      <div className="h-3 border-2 border-phosphor bg-ink" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={target} aria-valuenow={done}>
        <div className={`h-full ${done >= target ? "bg-signal" : "bg-field"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** This week at a glance: both meters, days left, and the status. */
export function QuotaWeekCard({ week, endsAt, link = false }: { week: QuotaWeek; endsAt: number; link?: boolean }) {
  return (
    <div className="slab relative space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="label text-sm text-dim">This week · {weekLabel(week.week)}</h3>
        <StatusChip status={week.status} />
        {week.status === "in_progress" && <span className="text-sm text-dim">{daysLeft(endsAt)} days left</span>}
        {link && (
          <a href={routeHash({ view: "quota" })} className="ml-auto text-sm text-dim hover:text-phosphor hover:underline">
            Quota →
          </a>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Meter label="Videos" done={week.done.videos} target={week.target.videos} />
        <Meter label="Reels" done={week.done.reels} target={week.target.reels} />
      </div>
    </div>
  );
}

/** Home's quota card. Says nothing when the quota can't be read (an older backend has none). */
export function QuotaCard() {
  const { quota } = useQuota();
  if (!quota?.weeks.length) return null;
  return <QuotaWeekCard week={quota.weeks[0]} endsAt={quota.week_ends_at} link />;
}

function Settings({ targets, start, onTargets, onStart }: {
  targets: QuotaCounts;
  start: string;
  onTargets: (t: QuotaCounts) => Promise<void>;
  onStart: (w: string) => Promise<void>;
}) {
  const [videos, setVideos] = useState(String(targets.videos));
  const [reels, setReels] = useState(String(targets.reels));
  const [week, setWeek] = useState(start);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (f: () => Promise<void>, ok: string) => {
    setMsg(null);
    try {
      await f();
      setMsg({ ok: true, text: ok });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };
  return (
    <details className="slab relative p-4">
      <summary className="label cursor-pointer text-sm">Quota settings</summary>
      <div className="mt-3 flex flex-wrap items-end gap-4">
        <label className="space-y-1 text-xs text-dim">
          <span className="label block">Videos a week</span>
          <input type="number" min={0} max={100} value={videos} onChange={(e) => setVideos(e.target.value)} className={`${field} w-24`} />
        </label>
        <label className="space-y-1 text-xs text-dim">
          <span className="label block">Reels a week</span>
          <input type="number" min={0} max={100} value={reels} onChange={(e) => setReels(e.target.value)} className={`${field} w-24`} />
        </label>
        <button
          type="button"
          className={btn}
          onClick={() => run(() => onTargets({ videos: Number(videos), reels: Number(reels) }), "Saved. Applies from this week; past weeks keep their targets.")}
        >
          Save targets
        </button>
        <label className="space-y-1 text-xs text-dim">
          <span className="label block">Tracking starts (a Monday)</span>
          <input type="date" value={week} onChange={(e) => setWeek(e.target.value)} className={field} />
        </label>
        <button type="button" className={btn} onClick={() => run(() => onStart(week), "Start week saved.")}>
          Save start
        </button>
      </div>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`mt-2 text-sm ${msg.ok ? "text-signal" : "text-rec"}`}>
          {msg.text}
        </p>
      )}
    </details>
  );
}

/** Every week from the start: target vs delivered, Met / Missed / Excused, and what counted. */
export function QuotaView({ role }: { role: "admin" | "editor" }) {
  const { quota, error, setTargets, setStart, setExcused } = useQuota();
  const ask = useAsk();
  const [actionError, setActionError] = useState<string | null>(null);
  const isAdmin = role === "admin";
  const past = quota?.weeks.filter((w) => w.status !== "in_progress") ?? [];
  const missed = past.filter((w) => w.status === "missed").length;

  async function excuse(w: QuotaWeek) {
    setActionError(null);
    try {
      if (w.excused) {
        await setExcused(w.week, false);
        return;
      }
      const note = await ask.prompt({ title: `Excuse ${weekLabel(w.week)}?`, label: "Reason (optional)", confirmLabel: "Excuse week" });
      if (note !== null) await setExcused(w.week, true, note);
    } catch (e) {
      setActionError((e as Error).message);
    }
  }

  return (
    <section className="space-y-6">
      <h2 tabIndex={-1} className="stencil tilt slam text-4xl">
        Quota
      </h2>
      {(error || actionError) && (
        <p role="alert" className="text-rec">
          {error || actionError}
        </p>
      )}
      {quota && (
        <>
          {quota.weeks[0] && <QuotaWeekCard week={quota.weeks[0]} endsAt={quota.week_ends_at} />}
          <p className="text-sm text-dim">
            {quota.targets.videos} videos and {quota.targets.reels} reels a week. A tape or reel counts in the week its Final version was
            uploaded.
            {past.length > 0 && ` ${missed} of ${past.length} past week${past.length === 1 ? "" : "s"} missed.`}
          </p>
          {isAdmin && <Settings key={`${quota.start_week}-${quota.targets.videos}-${quota.targets.reels}`} targets={quota.targets} start={quota.start_week} onTargets={setTargets} onStart={setStart} />}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="label text-xs text-dim">
                <tr>
                  <th className="px-2 py-2">Week</th>
                  <th className="px-2 py-2">Videos</th>
                  <th className="px-2 py-2">Reels</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Difference</th>
                </tr>
              </thead>
              {quota.weeks.map((w) => (
                <tbody key={w.week} className="border-t-2 border-seam">
                  <tr>
                    <td className="px-2 py-2 font-bold">{weekLabel(w.week)}</td>
                    <td className="px-2 py-2 osd text-lg">
                      {w.done.videos}/{w.target.videos}
                    </td>
                    <td className="px-2 py-2 osd text-lg">
                      {w.done.reels}/{w.target.reels}
                    </td>
                    <td className="px-2 py-2">
                      <StatusChip status={w.status} />
                    </td>
                    <td className={`px-2 py-2 ${w.status === "missed" ? "text-rec" : "text-dim"}`}>
                      {w.status === "excused" && w.note ? w.note : gap(w)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="px-2 pb-3">
                      <details>
                        <summary className="cursor-pointer text-xs text-dim">
                          {w.tapes.length} delivered
                        </summary>
                        <ul className="mt-2 grid gap-1">
                          {w.tapes.map((t) => (
                            <li key={t.id} className="flex flex-wrap gap-2">
                              <span className="label text-xs text-dim">{t.kind === "reel" ? "Reel" : "Video"}</span>
                              <a href={routeHash({ view: "tape", projectId: t.project_id, tapeId: t.id })} className="hover:underline">
                                {t.name}
                              </a>
                              <span className="text-dim">
                                {t.project_name} · uploaded {new Date(t.final_upload_at * 1000).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {isAdmin && w.status !== "met" && (
                          <button type="button" className={`${btn} mt-2`} onClick={() => excuse(w)}>
                            {w.excused ? "Un-excuse week" : "Excuse week"}
                          </button>
                        )}
                      </details>
                    </td>
                  </tr>
                </tbody>
              ))}
            </table>
          </div>
        </>
      )}
      {ask.dialog}
    </section>
  );
}
