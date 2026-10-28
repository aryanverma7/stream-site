"use client";

import { useEffect, useState } from "react";
import { editorApi } from "./editorApi";

export interface EditorMe {
  username: string;
  role: "admin" | "editor";
  /** The Drive "Brand kit" folder, null until Drive has been connected. */
  brand_kit_url: string | null;
}

/**
 * Who is signed in, which decides what the editor app shows. Showing is
 * all it decides: every streamer-only action is refused by the server too.
 */
export function useEditorMe(): { me: EditorMe | null; error: string | null } {
  const [me, setMe] = useState<EditorMe | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    editorApi<EditorMe>("/me")
      .then(setMe)
      .catch((e: Error) => setError(e.message));
  }, []);

  return { me, error };
}
