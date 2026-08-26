/**
 * Pure parsing/validation for incoming chat messages from the widget hub
 * WebSocket - deliberately separate from the WebSocket connection itself,
 * since jsdom has no real WebSocket server to test against, but this
 * parsing logic can be fully tested without one.
 *
 * Matches the exact shape streamerbot_client.py's forward_chat_to_widgets
 * broadcasts: {"type": "chat_message", "platform": "twitch"|"youtube",
 * "username": string, "message": string}.
 */
export interface ChatMessage {
  platform: string;
  username: string;
  message: string;
}

export function parseChatMessage(raw: string): ChatMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof data !== "object" || data === null) return null;
  const obj = data as Record<string, unknown>;

  if (obj.type !== "chat_message") return null;
  if (typeof obj.platform !== "string") return null;
  if (typeof obj.username !== "string") return null;
  if (typeof obj.message !== "string") return null;

  return {
    platform: obj.platform,
    username: obj.username,
    message: obj.message,
  };
}
