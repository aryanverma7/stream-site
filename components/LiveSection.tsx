"use client";

import { useLiveStatus } from "@/lib/useLiveStatus";
import { TwitchEmbed } from "./TwitchEmbed";
import { MergedChat } from "./MergedChat";
import { OfflineRecommendations } from "./OfflineRecommendations";

const TWITCH_CHANNEL = "dualbladex";

/**
 * Replaces the earlier placeholder. Polls live status (Plan A's already
 * tested /api/public/live-status) and conditionally shows either the
 * Twitch embed + merged chat, or curated offline recommendations - per
 * spec Section 6.
 */
export function LiveSection() {
  const live = useLiveStatus();

  return (
    <section className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-[#0F1923] px-6 py-16 text-[#ECE8E1]">
      <h2
        className="text-2xl tracking-[0.2em]"
        style={{ fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700 }}
      >
        {live === null ? "CHECKING STATUS..." : live ? "LIVE NOW" : "OFFLINE"}
      </h2>

      {live === true && (
        <div className="grid w-full max-w-6xl grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]">
          <div className="aspect-video overflow-hidden rounded border border-[#34f5c5]/20">
            <TwitchEmbed channel={TWITCH_CHANNEL} />
          </div>
          <div className="h-[300px] overflow-hidden rounded border border-[#34f5c5]/20 bg-[#151F2B] md:h-auto">
            <MergedChat />
          </div>
        </div>
      )}

      {live === false && (
        <div className="w-full max-w-4xl">
          <p className="mb-4 text-center text-sm uppercase tracking-widest text-[#9AA3AC]">
            Not live right now — check out these instead
          </p>
          <OfflineRecommendations />
        </div>
      )}
    </section>
  );
}
