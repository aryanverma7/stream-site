"use client";

import { useMemo, useState } from "react";
import { useConfigEditor } from "@/lib/useConfigEditor";
import {
  SECRET_MASK,
  buildPayload,
  changedKeys,
  groupBySection,
  missingFields,
  searchFields,
  validateField,
  type NewField,
  type Schema,
} from "@/lib/settingsModel";
import { AddSetting, BUTTON, FieldInput, INPUT } from "./SettingsField";

/**
 * One "connect this account" row.
 *
 * Shared because Streamlabs, Spotify and Google Drive need
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
    <div className="mb-4 border border-seam bg-ink px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-phosphor">{name}</p>
          <p
            className={`text-xs font-bold uppercase tracking-widest ${
              connected ? "text-field" : "text-dim"
            }`}
          >
            {connected ? "Connected" : "Not connected"}
          </p>
        </div>
        {!connected && hasCredentials && (
          <a
            href={href}
            className="wallpaper px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.08em] hover:bg-field-hot"
          >
            Connect {name}
          </a>
        )}
      </div>
      {!connected && !hasCredentials && (
        <p className="mt-2 max-w-prose text-[13px] leading-snug text-dim">
          Fill in {needed} below first, then save - the connect link appears once those are set.
        </p>
      )}
    </div>
  );
}

const ADVANCED = "__advanced__";
const RAW_INVALID = "That's not valid JSON - check for a stray comma or missing quote.";

/**
 * The editing copy of the config: json fields become their pretty-printed
 * text, so an untouched one compares equal to the original and a half-typed
 * one can be held (and reported invalid) without being parsed.
 */
function toDraft(config: Record<string, unknown>, schema: Schema | null): Record<string, unknown> {
  const out = { ...config };
  for (const [k, m] of Object.entries(schema?.fields ?? {})) {
    if (m.type === "json" && k in out) out[k] = JSON.stringify(out[k], null, 2);
  }
  return out;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function ConfigEditor() {
  const editor = useConfigEditor();
  const { config, loading, error, saveError, saveSuccess } = editor;

  return (
    <div className="border border-seam bg-bezel p-6">
      <h3 className="stencil mb-4 text-4xl text-phosphor">Settings</h3>

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

      {config && <ConnectRow
        name="Google Drive"
        connected={Boolean(config.gdrive_refresh_token)}
        hasCredentials={Boolean(config.gdrive_client_id)}
        href="/auth/gdrive/login"
        needed="gdrive_client_id, gdrive_client_secret, and gdrive_redirect_uri (see GDRIVE_SETUP.md)"
      />}

      {error && <p className="text-sm text-rec">Couldn&apos;t load the config.</p>}
      {saveError && <p className="mb-2 text-sm text-rec">Save failed: {saveError}</p>}
      {saveSuccess && <p className="mb-2 text-sm text-field">Saved.</p>}
      {loading && <p className="text-sm text-dim">Loading config...</p>}

      {!loading && !error && config && <SettingsEditor {...editor} config={config} />}
    </div>
  );
}

/** Red banner naming every needed setting still empty; each name jumps to its field. */
function MissingSettings({ keys, schema, onJump }: { keys: string[]; schema: Schema; onJump: (key: string) => void }) {
  if (!keys.length) return null;
  return (
    <div role="alert" className="mb-4 border border-rec bg-rec/10 px-4 py-3">
      <p className="text-sm font-bold text-rec">
        {keys.length === 1 ? "1 important setting is empty" : `${keys.length} important settings are empty`}
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {keys.map((k) => (
          <li key={k}>
            <button
              type="button"
              onClick={() => onJump(k)}
              className="border border-rec/60 px-2 py-1 text-xs text-phosphor hover:bg-rec/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-field"
            >
              <span className="text-dim">{schema.fields[k].section} · </span>
              {schema.fields[k].label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

type EditorProps = Omit<ReturnType<typeof useConfigEditor>, "config"> & { config: Record<string, unknown> };

function SettingsEditor({ config, schema: rawSchema, schemaMissing, saving, saveError, saveErrorField, save }: EditorProps) {
  // A schema without both parts is unusable; fall back to raw JSON rather than crash.
  const schema = Array.isArray(rawSchema?.sections) && rawSchema?.fields ? rawSchema : null;
  const base = useMemo(() => toDraft(config, schema), [config, schema]);
  const groups = useMemo(() => (schema ? groupBySection(schema) : []), [schema]);

  const [loaded, setLoaded] = useState(config);
  const [generation, setGeneration] = useState(0);
  const [edited, setEdited] = useState(base);
  const [newFields, setNewFields] = useState<NewField[]>([]);
  const [raw, setRaw] = useState(() => JSON.stringify(config, null, 2));
  const [rawError, setRawError] = useState<string | null>(null);
  const [view, setView] = useState(schemaMissing || !schema ? ADVANCED : (groups[0]?.section ?? ADVANCED));
  const [query, setQuery] = useState("");

  const reset = () => {
    setEdited(base);
    setNewFields([]);
    setGeneration((g) => g + 1); // remounts inputs holding local state (secret Replace, list drafts)
  };

  // A save reloads the config: start over from what the backend now holds.
  if (loaded !== config) {
    setLoaded(config);
    setEdited(base);
    setNewFields([]);
    setRaw(JSON.stringify(config, null, 2));
    setGeneration((g) => g + 1);
  }

  const changed = schema ? changedKeys(base, edited).filter((k) => schema.fields[k]) : [];
  const errors: Record<string, string> = {};
  for (const k of changed) {
    const e = validateField(schema!.fields[k], edited[k]);
    if (e) errors[k] = e;
  }
  for (const n of newFields) {
    const e = validateField({ label: n.key, description: "", section: n.section, type: n.type }, n.value);
    if (e) errors[n.key] = e;
  }
  const changeCount = changed.length + newFields.length;
  const errorCount = Object.keys(errors).length;

  const handleSave = () => {
    if (!schema || errorCount) return;
    save(buildPayload(base, edited, newFields, schema));
  };

  const handleRawSave = () => {
    setRawError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setRawError(RAW_INVALID);
      return;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      setRawError(RAW_INVALID);
      return;
    }
    const obj = parsed as Record<string, unknown>;
    const payload: Record<string, unknown> = {};
    for (const k of changedKeys(config, obj)) if (obj[k] !== SECRET_MASK) payload[k] = obj[k];
    save(payload);
  };

  const activeView = view === ADVANCED || groups.some((g) => g.section === view) ? view : (groups[0]?.section ?? ADVANCED);
  const searching = Boolean(schema && query.trim());
  const visible: { section: string; keys: string[] }[] = searching
    ? (() => {
        const hits = new Set(searchFields(schema!, query));
        return groups.map((g) => ({ ...g, keys: g.keys.filter((k) => hits.has(k)) })).filter((g) => g.keys.length);
      })()
    : groups.filter((g) => g.section === activeView);

  // From the saved config, not the draft: the banner clears once a save lands.
  const missing = schema ? missingFields(schema, config) : [];
  const jumpTo = (key: string) => {
    setQuery("");
    setView(schema!.fields[key].section);
    requestAnimationFrame(() => document.getElementById(`setting-${key}`)?.focus());
  };

  const row = (key: string) => {
    const meta = schema!.fields[key];
    const id = `setting-${key}`;
    const isChanged = changed.includes(key);
    return (
      <div
        key={key}
        data-field={key}
        className={`border-l-2 py-3 pl-4 ${isChanged ? "border-field bg-ink/40" : "border-transparent"}`}
      >
        <div className="flex flex-wrap items-baseline gap-x-3">
          <label htmlFor={id} className="text-sm font-semibold text-phosphor">
            {meta.label}
          </label>
          <code className="font-mono text-[11px] text-dim">{key}</code>
          {isChanged && <span className="text-[10px] font-bold uppercase tracking-widest text-field">Changed</span>}
          {missing.includes(key) && <span className="text-[10px] font-bold uppercase tracking-widest text-rec">Needed</span>}
        </div>
        {meta.description && <p className="mb-2 max-w-prose text-[13px] leading-snug text-dim">{meta.description}</p>}
        <FieldInput
          id={id}
          meta={meta}
          value={edited[key]}
          original={base[key]}
          onChange={(v) => setEdited((e) => ({ ...e, [key]: v }))}
        />
        {errors[key] && <p className="mt-1 text-sm text-rec">{errors[key]}</p>}
        {saveError && saveErrorField === key && <p className="mt-1 text-sm text-rec">{saveError}</p>}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <nav aria-label="Settings sections" className="flex shrink-0 flex-col gap-1 md:w-56">
        {groups.map((g) => (
          <SectionButton
            key={g.section}
            active={!searching && activeView === g.section}
            onClick={() => {
              setQuery("");
              setView(g.section);
            }}
          >
            {g.section}
            <span className="text-dim">{g.keys.length}</span>
          </SectionButton>
        ))}
        <SectionButton active={!searching && activeView === ADVANCED} onClick={() => { setQuery(""); setView(ADVANCED); }}>
          Advanced (raw JSON)
        </SectionButton>
      </nav>

      <div className="min-w-0 flex-1">
        {schema && <MissingSettings keys={missing} schema={schema} onJump={jumpTo} />}

        {schema && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label htmlFor="settings-search" className="sr-only">
              Search all settings
            </label>
            <input
              id="settings-search"
              type="search"
              value={query}
              placeholder="Search all settings"
              onChange={(e) => setQuery(e.target.value)}
              className={`${INPUT} min-w-0 flex-1`}
            />
            <AddSetting
              key={`add-${generation}`}
              sections={schema.sections}
              existing={{ ...edited, ...Object.fromEntries(newFields.map((n) => [n.key, n.value])) }}
              onAdd={(n) => setNewFields((f) => [...f, n])}
            />
          </div>
        )}

        {newFields.length > 0 && (
          <ul className="mb-4 border border-seam bg-ink px-4 py-2 text-sm">
            {newFields.map((n) => (
              <li key={n.key} className="flex items-center justify-between gap-2 py-1">
                <span>
                  <span className="text-field">New:</span> <code className="font-mono text-xs">{n.key}</code>{" "}
                  <span className="text-dim">
                    ({n.type}, {n.section})
                  </span>
                  {errors[n.key] && <span className="ml-2 text-rec">{errors[n.key]}</span>}
                </span>
                <button
                  type="button"
                  aria-label={`Remove new setting ${n.key}`}
                  onClick={() => setNewFields((f) => f.filter((x) => x.key !== n.key))}
                  className="px-1 text-dim hover:text-rec focus-visible:outline focus-visible:outline-2 focus-visible:outline-field"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        {activeView === ADVANCED && !searching ? (
          <div>
            {schemaMissing && (
              <p className="mb-3 max-w-prose text-[13px] leading-snug text-dim">
                This backend is older than the site - showing raw JSON until it is updated.
              </p>
            )}
            <p className="mb-3 max-w-prose text-[13px] leading-snug text-dim">
              Full config as raw JSON. Secrets are masked by the backend; a masked value is left as it is.
            </p>
            {rawError && <p className="mb-2 text-sm text-rec">{rawError}</p>}
            <label htmlFor="raw-config" className="sr-only">
              Raw config JSON
            </label>
            <textarea
              id="raw-config"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              spellCheck={false}
              className="h-[60vh] w-full resize-y border border-seam bg-ink p-4 font-mono text-[12px] leading-relaxed text-phosphor focus:border-field focus:outline-none"
            />
            <button type="button" onClick={handleRawSave} disabled={saving} className={`${BUTTON} mt-2`}>
              {saving ? "Saving..." : "Save raw JSON"}
            </button>
          </div>
        ) : (
          <div key={generation}>
            {searching && visible.length === 0 && <p className="text-sm text-dim">No settings match.</p>}
            {visible.map((g) => (
              <section key={g.section} className="mb-4">
                <h4 className="stencil mb-1 text-2xl text-phosphor">{g.section}</h4>
                <div className="divide-y divide-seam">{g.keys.map(row)}</div>
              </section>
            ))}
          </div>
        )}

        {changeCount > 0 && (
          <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 border border-seam bg-ink px-4 py-3">
            <p className={`text-sm ${errorCount ? "text-rec" : "text-phosphor"}`}>
              {plural(changeCount, "unsaved change") +
                (errorCount ? ` · ${plural(errorCount, "error")} to fix before saving` : "")}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={reset}
                className="border border-seam px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-dim hover:text-phosphor focus-visible:outline focus-visible:outline-2 focus-visible:outline-field"
              >
                Discard
              </button>
              <button type="button" onClick={handleSave} disabled={saving || errorCount > 0} className={BUTTON}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={`flex items-center justify-between gap-2 border px-3 py-1.5 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-field ${
        active ? "border-field bg-ink text-phosphor" : "border-seam text-dim hover:text-phosphor"
      }`}
    >
      {children}
    </button>
  );
}
