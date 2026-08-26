"use client";

import { useEffect, useState } from "react";
import { useConfigEditor } from "@/lib/useConfigEditor";

export function ConfigEditor() {
  const { config, loading, error, saving, saveError, saveSuccess, save } = useConfigEditor();
  const [text, setText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    if (config) setText(JSON.stringify(config, null, 2));
  }, [config]);

  const handleSave = () => {
    setParseError(null);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      setParseError("That's not valid JSON - check for a stray comma or missing quote.");
      return;
    }
    save(parsed);
  };

  return (
    <div className="rounded border border-[#34f5c5]/20 bg-[#151F2B] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm uppercase tracking-widest text-[#ECE8E1]">Config Editor</h3>
        <button
          type="button"
          onClick={handleSave}
          disabled={loading || saving}
          className="rounded bg-[#34f5c5]/10 px-4 py-1.5 text-xs uppercase tracking-widest text-[#34f5c5] hover:bg-[#34f5c5]/20 disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      <p className="mb-3 text-xs text-[#9AA3AC]">
        Full config as raw JSON, including secrets - this is your own personal
        secrets file. Changes take effect immediately, no restart needed.
      </p>

      {config && (() => {
        const isConnected = Boolean(config.streamlabs_access_token);
        const hasCredentials = Boolean(config.streamlabs_client_id);
        return (
          <div className="mb-4 rounded border border-[#34f5c5]/10 bg-[#0F1923] px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#ECE8E1]">Streamlabs</p>
                <p
                  className={`text-xs font-bold uppercase tracking-widest ${
                    isConnected ? "text-[#34f5c5]" : "text-[#9AA3AC]"
                  }`}
                >
                  {isConnected ? "Connected" : "Not connected"}
                </p>
              </div>
              {!isConnected && hasCredentials && (
                <a
                  href="/auth/streamlabs/login"
                  className="rounded bg-[#34f5c5]/10 px-4 py-1.5 text-xs uppercase tracking-widest text-[#34f5c5] hover:bg-[#34f5c5]/20"
                >
                  Connect Streamlabs
                </a>
              )}
            </div>
            {!isConnected && !hasCredentials && (
              <p className="mt-2 text-xs text-[#9AA3AC]">
                Fill in streamlabs_client_id, streamlabs_client_secret, and
                streamlabs_redirect_uri below first, then save - the connect
                link appears once those are set.
              </p>
            )}
          </div>
        );
      })()}

      {error && <p className="text-sm text-[#B8323F]">Couldn&apos;t load the config.</p>}
      {parseError && <p className="mb-2 text-sm text-[#B8323F]">{parseError}</p>}
      {saveError && <p className="mb-2 text-sm text-[#B8323F]">Save failed: {saveError}</p>}
      {saveSuccess && <p className="mb-2 text-sm text-[#34f5c5]">Saved.</p>}

      {loading && <p className="text-sm text-[#9AA3AC]">Loading config...</p>}

      {!loading && !error && (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          className="h-96 w-full resize-y rounded border border-[#34f5c5]/10 bg-[#0F1923] p-3 font-mono text-xs text-[#ECE8E1] focus:border-[#34f5c5]/40 focus:outline-none"
        />
      )}
    </div>
  );
}
