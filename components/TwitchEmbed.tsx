"use client";

import { useEffect, useState } from "react";

/**
 * Twitch's official embed player. Requires the real hostname as `parent` -
 * a security requirement on Twitch's end, not something that can be
 * relative. Read from the browser at runtime rather than hardcoded, so it
 * keeps working correctly regardless of which domain the page is actually
 * viewed from.
 */
export function TwitchEmbed({ channel }: { channel: string }) {
  const [parent, setParent] = useState<string | null>(null);

  useEffect(() => {
    setParent(window.location.hostname);
  }, []);

  if (!parent) return null;

  return (
    <iframe
      src={`https://player.twitch.tv/?channel=${channel}&parent=${parent}&muted=true`}
      height="100%"
      width="100%"
      allowFullScreen
      title={`${channel} on Twitch`}
    />
  );
}
