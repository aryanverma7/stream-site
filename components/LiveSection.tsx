"use client";

import { useLiveStatus } from "@/lib/useLiveStatus";
import { useSiteConfig } from "@/lib/useSiteConfig";
import { TwitchEmbed } from "./TwitchEmbed";
import { MergedChat } from "./MergedChat";
import { OfflineRecommendations } from "./OfflineRecommendations";
import { FeedFrame } from "./FeedFrame";

const TWITCH_CHANNEL = "dualbladex";

function RecTag() {
  return (
    <>
      <span className="rec-dot inline-block h-2.5 w-2.5 rounded-full bg-rec" aria-hidden />
      REC
    </>
  );
}

/**
 * The feed itself. Live: the Twitch player on CAM 02 with the merged chat
 * beside it. Offline: a dead channel, a way to hear about the next stream,
 * and the archive tapes (curated YouTube videos).
 */
export function LiveSection() {
  const live = useLiveStatus();
  const { socialLinks } = useSiteConfig();

  return (
    <section id="feed" className="w-full scroll-mt-4 bg-ink px-4 py-16 text-phosphor sm:px-6 md:py-24">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="stencil text-[clamp(3rem,9vw,5.5rem)] text-field">
            {live === null ? "Checking status..." : live ? "Live now" : "Offline"}
          </h2>
          {live && socialLinks.youtube && (
            <a
              href={socialLinks.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="label border border-seam px-3 py-2 text-xs text-dim transition-colors hover:border-field hover:text-field"
            >
              Also on YouTube
            </a>
          )}
        </header>

        {live === true && (
          <div className="crt-on grid w-full grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
            <FeedFrame label={`CAM 02 · twitch.tv/${TWITCH_CHANNEL}`} right={<RecTag />} bodyClassName="aspect-video">
              <TwitchEmbed channel={TWITCH_CHANNEL} />
            </FeedFrame>
            <FeedFrame label="Chat · Twitch + YouTube" tone="field" className="h-[360px] lg:h-auto">
              <MergedChat />
            </FeedFrame>
          </div>
        )}

        {live === false && (
          <>
            <FeedFrame label="CAM 02 · twitch.tv/dualbladex" right="00:00:00" tone="dim" className="crt-on">
              <div className="crt relative grid min-h-[280px] place-items-center overflow-hidden md:min-h-[360px]">
                <div className="noise absolute inset-0 opacity-90" aria-hidden />
                <div className="relative z-10 flex flex-col items-center gap-4 px-6 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element -- static export, local sticker */}
                  <img src="/stickers/shock.png" alt="" className="sticker w-24 rotate-[8deg] md:w-28" />
                  <p className="osd bg-ink/85 px-4 py-2 text-4xl text-phosphor md:text-5xl">No signal</p>
                  <p className="max-w-md bg-ink/85 px-3 py-1.5 text-sm text-phosphor">
                    Not live right now — check out these instead
                  </p>
                  {socialLinks.twitch && (
                    <a
                      href={socialLinks.twitch}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="wallpaper px-5 py-2.5 text-sm font-extrabold uppercase tracking-[0.08em] transition-colors hover:bg-field-hot"
                    >
                      Follow to catch the next stream
                    </a>
                  )}
                </div>
              </div>
            </FeedFrame>
            <OfflineRecommendations />
          </>
        )}
      </div>
    </section>
  );
}
