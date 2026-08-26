"use client";

import { useSiteConfig } from "@/lib/useSiteConfig";

/**
 * Per spec Section 9: four social links, quiet and understated, matching
 * "minimal" - the page's natural resting point. Sourced from
 * /api/public/site-config, already built and tested in Task #4.
 *
 * The hidden admin gateway used to live in this footer per the original
 * spec - that entire mechanism has since moved to the dragon's own
 * click-power game, so there's deliberately no admin marker here anymore.
 *
 * Icons are small hand-crafted SVGs rather than an icon library dependency -
 * consistent with this project's established lean-dependencies approach.
 */
const ICONS: Record<string, React.ReactNode> = {
  twitch: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M4.5 2 3 5.5v14h5V22l3-2.5h4L21 14V2H4.5zm14.5 11-3 3h-4l-2.5 2.5V16H6V4h13v9z" />
      <path d="M14.5 6.5h2v5h-2zm-4.5 0h2v5h-2z" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M21.6 7.2s-.2-1.5-.8-2.2c-.8-.9-1.7-.9-2.1-.9C15.9 4 12 4 12 4h0s-3.9 0-6.7.1c-.4 0-1.3 0-2.1.9-.6.7-.8 2.2-.8 2.2S2.2 9 2.2 10.7v1.6C2.2 14 2.4 15.8 2.4 15.8s.2 1.5.8 2.2c.8.9 1.9.9 2.4 1 1.7.2 7.4.2 7.4.2s3.9 0 6.7-.2c.4 0 1.3 0 2.1-.9.6-.7.8-2.2.8-2.2s.2-1.7.2-3.5v-1.6c0-1.7-.2-3.5-.2-3.5zM9.9 14.6V8.9l5.4 2.9-5.4 2.8z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.9.2 2.3.4.6.2 1 .5 1.4.9.4.4.7.9.9 1.4.2.4.4 1 .4 2.3.1 1.3.1 1.6.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.9-.4 2.3-.2.6-.5 1-.9 1.4-.4.4-.9.7-1.4.9-.4.2-1 .4-2.3.4-1.3.1-1.6.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.9-.2-2.3-.4a3.9 3.9 0 0 1-1.4-.9 3.9 3.9 0 0 1-.9-1.4c-.2-.4-.4-1-.4-2.3-.1-1.3-.1-1.6-.1-4.9s0-3.6.1-4.9c.1-1.2.2-1.9.4-2.3.2-.6.5-1 .9-1.4.4-.4.9-.7 1.4-.9.4-.2 1-.4 2.3-.4 1.3-.1 1.6-.1 4.9-.1zM12 0C8.7 0 8.3 0 7 .1c-1.3.1-2.2.2-3 .5-.8.3-1.5.7-2.2 1.4A6 6 0 0 0 .4 4.2c-.3.8-.5 1.7-.5 3C-.1 8.3-.1 8.7-.1 12s0 3.7.1 5c.1 1.3.2 2.2.5 3 .3.8.7 1.5 1.4 2.2.7.7 1.4 1.1 2.2 1.4.8.3 1.7.5 3 .5 1.3.1 1.7.1 5 .1s3.7 0 5-.1c1.3-.1 2.2-.2 3-.5.8-.3 1.5-.7 2.2-1.4.7-.7 1.1-1.4 1.4-2.2.3-.8.5-1.7.5-3 .1-1.3.1-1.7.1-5s0-3.7-.1-5c-.1-1.3-.2-2.2-.5-3a6 6 0 0 0-1.4-2.2A6 6 0 0 0 20 .6c-.8-.3-1.7-.5-3-.5C15.7 0 15.3 0 12 0z" />
      <path d="M12 5.8a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4zm0 10.2a4 4 0 1 1 0-8 4 4 0 0 1 0 8zM18.4 5.6a1.4 1.4 0 1 1-2.8 0 1.4 1.4 0 0 1 2.8 0z" />
    </svg>
  ),
  discord: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M20.3 5.3A18 18 0 0 0 15.9 4c-.2.4-.4.9-.6 1.3a16.6 16.6 0 0 0-4.9 0c-.1-.4-.4-.9-.6-1.3-1.5.3-3 .7-4.4 1.3C2.9 9 2 12.6 2.4 16.1a18.1 18.1 0 0 0 5.5 2.8c.4-.6.8-1.3 1.1-2a11.6 11.6 0 0 1-1.8-.9l.4-.3a12.8 12.8 0 0 0 10.8 0l.4.3c-.6.3-1.2.6-1.8.9.3.7.7 1.4 1.1 2a18 18 0 0 0 5.5-2.8c.5-4-.5-7.6-3.3-10.8zM9.7 13.9c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8zm4.6 0c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8z" />
    </svg>
  ),
};

const LABELS: Record<string, string> = {
  twitch: "Twitch",
  youtube: "YouTube",
  instagram: "Instagram",
  discord: "Discord",
};

export function Footer() {
  const { socialLinks } = useSiteConfig();
  const platforms = ["twitch", "youtube", "instagram", "discord"] as const;

  return (
    <footer className="flex h-[40vh] w-full flex-col items-center justify-center gap-6 bg-[#0F1923] text-[#ECE8E1]">
      <div className="flex gap-6">
        {platforms.map((platform) => {
          const href = socialLinks[platform];
          if (!href) return null;

          return (
            <a
              key={platform}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={LABELS[platform]}
              className="text-[#9AA3AC] transition-colors hover:text-[#34f5c5]"
            >
              {ICONS[platform]}
            </a>
          );
        })}
      </div>
      <p className="text-xs uppercase tracking-widest text-[#9AA3AC]/50">DualBladeX</p>
    </footer>
  );
}
