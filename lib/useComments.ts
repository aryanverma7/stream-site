"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorApiError, editorApi } from "./editorApi";
import * as queue from "./unsentQueue";

export type Reply = { id: number; comment_id: number; author: string; body: string; created_at: number };
export type Comment = {
  id: number;
  kind: "fix" | "keep" | "question";
  author: string;
  body: string;
  start_s: number | null;
  end_s: number | null;
  created_at: number;
  updated_at: number;
  resolved: boolean;
  carried?: boolean;
  origin_iteration_id: number;
  origin_version: number;
  replies: Reply[];
};
export type Draft = { kind: Comment["kind"]; body: string; start_s: number | null; end_s: number | null };
export type Failed = { client_id: string; message: string; body: string };

const EVERY_MS = 30_000;
const every = (fn: () => void, ms: number) => {
  const h = setInterval(fn, ms);
  return () => clearInterval(h);
};

export function useComments(
  iterationId: number,
  { role, username }: { role: "admin" | "editor"; username: string },
  { schedule = every }: { schedule?: (fn: () => void, ms: number) => () => void } = {},
) {
  const [comments, setComments] = useState<Comment[]>([]);
  // undefined: not known yet. null: first visit. A failed call shows nothing as new.
  const [previousSeen, setPreviousSeen] = useState<number | null | undefined>(undefined);
  const [all, setAll] = useState<queue.Entry[]>(() => queue.list());
  const [failed, setFailed] = useState<Failed[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const d = await editorApi<{ comments: Comment[] }>(`/iterations/${iterationId}`);
      setComments(d.comments.map((c) => ({ ...c, replies: c.replies ?? [] })));
    } catch {
      // keep what is on screen
    }
  }, [iterationId]);

  useEffect(() => {
    editorApi<{ previous_seen_at: number | null }>(`/iterations/${iterationId}/seen`, { method: "POST" })
      .then((d) => setPreviousSeen(d.previous_seen_at))
      .catch(() => setPreviousSeen(Infinity));
    void Promise.resolve().then(reload);
  }, [iterationId, reload]);

  const running = useRef(false);
  const again = useRef(false);
  const flushNow = useCallback(async () => {
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    let sent = false;
    try {
      do {
        again.current = false;
        await queue.flush(async (e) => {
          try {
            await editorApi(
              e.kind === "comment" ? `/iterations/${e.iterationId}/comments` : `/comments/${e.commentId}/replies`,
              { method: "POST", body: { ...e.payload, client_id: e.client_id } },
            );
            sent = true;
            return "sent";
          } catch (err) {
            // 4xx is the server's final answer, except 401: editorApi is already sending the browser to login, and the entry must survive to be sent after it
            if (err instanceof EditorApiError && err.status >= 400 && err.status < 500 && err.status !== 401) {
              setFailed((f) => [...f, { client_id: e.client_id, message: err.message, body: String(e.payload.body ?? "") }]);
              return "drop";
            }
            return "retry";
          }
        });
      } while (again.current);
    } finally {
      running.current = false;
      setAll(queue.list());
    }
    if (sent) await reload();
  }, [reload]);

  useEffect(() => {
    const online = () => void flushNow();
    window.addEventListener("online", online);
    const stop = schedule(() => {
      if (document.visibilityState === "visible" && queue.list().length) void flushNow();
    }, EVERY_MS);
    if (queue.list().length) void Promise.resolve().then(flushNow);
    return () => {
      window.removeEventListener("online", online);
      stop();
    };
  }, [flushNow, schedule]);

  const enqueueAndFlush = (e: queue.Entry) => {
    queue.enqueue(e);
    setAll(queue.list());
    return flushNow();
  };

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    }
  };

  return {
    role,
    comments,
    unsent: all.filter((e) => e.kind === "reply" || e.iterationId === iterationId),
    failed,
    error,
    dismissFailed: (id: string) => setFailed((f) => f.filter((x) => x.client_id !== id)),
    isNew: (item: { author: string; created_at: number }) =>
      previousSeen !== undefined && item.author !== username && item.created_at > (previousSeen ?? -Infinity),
    add: (draft: Draft) =>
      enqueueAndFlush({ client_id: queue.newClientId(), kind: "comment", iterationId, payload: { ...draft }, created_at: Date.now() }),
    reply: (commentId: number, body: string) =>
      enqueueAndFlush({ client_id: queue.newClientId(), kind: "reply", commentId, payload: { body }, created_at: Date.now() }),
    edit: (id: number, patch: { body?: string; kind?: Comment["kind"] }) => act(() => editorApi(`/comments/${id}`, { method: "PATCH", body: patch })),
    setResolved: (id: number, resolved: boolean) =>
      act(() => editorApi(`/iterations/${iterationId}/comments/${id}/resolved`, { method: "PUT", body: { resolved } })),
    reload,
  };
}

export type CommentsApi = ReturnType<typeof useComments>;
