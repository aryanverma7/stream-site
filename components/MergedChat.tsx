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
    <div
      ref={scrollRef}
      className="flex h-full flex-col gap-1 overflow-y-auto p-3"
      style={{ fontFamily: "'Rajdhani', sans-serif" }}
    >
      {messages.length === 0 && (
        <p className="text-sm italic text-[#9AA3AC]">Waiting for chat...</p>
      )}
      {messages.map((msg, i) => (
        <div key={i} className="text-sm text-[#ECE8E1]">
          <span
            className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
            style={{ backgroundColor: PLATFORM_COLORS[msg.platform] ?? "#9AA3AC" }}
            aria-label={msg.platform}
          />
          <span className="font-semibold text-[#34f5c5]">{msg.username}</span>
          <span className="mx-1">:</span>
          <span>{msg.message}</span>
        </div>
      ))}
    </div>
  );
}
