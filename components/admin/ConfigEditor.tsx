"use client";

import { useEffect, useState } from "react";
import { useConfigEditor } from "@/lib/useConfigEditor";

/**
 * One "connect this account" row.
 *
 * Shared rather than written twice because Streamlabs and Spotify need
 * exactly the same three states and the third one is the one people get
 * stuck in: an OAuth flow started before its client id and redirect URI
 * are saved fails at the provider with an error that names nothing useful,
 * so the connect link only appears once the credentials are actually
 * there, and says what is missing until then.
 */
function ConnectRow({
  name,
  connected,
  hasCredentials,
  href,
  needed,
}: {
  name: string;
  connected: boolean;
  hasCredentials: boolean;
  href: string;
  needed: string;
}) {
  return (
    <div className="mb-4 rounded border border-[#34f5c5]/10 bg-[#0F1923] px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[#ECE8E1]">{name}</p>
          <p
            className={`text-xs font-bold uppercase tracking-widest ${
              connected ? "text-[#34f5c5]" : "text-[#9AA3AC]"
            }`}
          >
            {connected ? "Connected" : "Not connected"}
          </p>
        </div>
        {!connected && hasCredentials && (
          <a
            href={href}
            className="rounded bg-[#34f5c5]/10 px-4 py-1.5 text-xs uppercase tracking-widest text-[#34f5c5] hover:bg-[#34f5c5]/20"
          >
            Connect {name}
          </a>
        )}
      </div>
      {!connected && !hasCredentials && (
        <p className="mt-2 text-xs text-[#9AA3AC]">
          Fill in {needed} below first, then save - the connect link appears once those are set.
        </p>
      )}
    </div>
  );
}

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

      {config && <ConnectRow
        name="Streamlabs"
        connected={Boolean(config.streamlabs_access_token)}
        hasCredentials={Boolean(config.streamlabs_client_id)}
        href="/auth/streamlabs/login"
        needed="streamlabs_client_id, streamlabs_client_secret, and streamlabs_redirect_uri"
      />}

      {config && <ConnectRow
        name="Spotify"
        connected={Boolean(config.spotify_refresh_token)}
        hasCredentials={Boolean(config.spotify_client_id)}
        href="/auth/spotify/login"
        needed="spotify_client_id, spotify_client_secret, and spotify_redirect_uri"
      />}

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
