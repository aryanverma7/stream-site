"use client";

import { useEffect, useRef, useState } from "react";
import { parseChatMessage, ChatMessage } from "@/lib/parseChatMessage";

const MAX_MESSAGES = 50;

const PLATFORM_COLORS: Record<string, string> = {
  twitch: "#9146FF",
  youtube: "#FF0000",
};

/**
 * Connects to the existing widget WebSocket hub (already built in Task #3),
 * tagged "chat" - fed by streamerbot_client.py's forward_chat_to_widgets
 * (Plan A). Relative WebSocket URL, matching the page's own protocol
 * (wss for https, ws for http) and host - no domain hardcoded.
 *
 * Only ever active during the Live section's live state, per spec Section
 * 7 - not a persistent element elsewhere on the page.
 */
export function MergedChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/widgets?widget=chat`);

    ws.onmessage = (event) => {
      const parsed = parseChatMessage(event.data);
      if (parsed) {
        setMessages((prev) => [...prev.slice(-(MAX_MESSAGES - 1)), parsed]);
      }
    };

    return () => ws.close();
  }, []);

  useEffect(() => {
    if (typeof scrollRef.current?.scrollTo === "function") {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [messages]);

  return (
    <div ref={scrollRef} className="absolute inset-0 flex flex-col gap-1.5 overflow-y-auto bg-ink/60 p-3">
      {messages.length === 0 && <p className="label text-xs text-dim">Waiting for chat...</p>}
      {messages.map((msg, i) => (
        <div key={i} className="text-sm leading-snug text-phosphor">
          <span
            className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
            style={{ backgroundColor: PLATFORM_COLORS[msg.platform] ?? "#9aa3b8" }}
            aria-label={msg.platform}
          />
          <span className="font-bold text-field">{msg.username}</span>
          <span className="mx-1 text-dim">:</span>
          <span>{msg.message}</span>
        </div>
      ))}
    </div>
  );
}
