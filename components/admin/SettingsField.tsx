"use client";

import { useState } from "react";
import {
  SECRET_MASK,
  validateField,
  validateNewKey,
  type FieldMeta,
  type FieldType,
  type NewField,
} from "@/lib/settingsModel";

export const INPUT =
  "border border-seam bg-ink px-3 py-1.5 text-sm text-phosphor focus:border-field focus:outline-none";
export const BUTTON =
  "wallpaper px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.08em] hover:bg-field-hot disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-field";
const GHOST =
  "border border-seam px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-dim hover:text-phosphor focus-visible:outline focus-visible:outline-2 focus-visible:outline-field";

type Props = {
  id: string;
  meta: FieldMeta;
  value: unknown;
  /** The loaded value; a secret's Cancel restores it. */
  original?: unknown;
  onChange: (value: unknown) => void;
};

/**
 * The input for one setting, chosen by its schema type. The row around it
 * owns the <label htmlFor={id}>; every control that label cannot reach
 * carries its own aria-label.
 */
export function FieldInput({ id, meta, value, original, onChange }: Props) {
  switch (meta.type) {
    case "number": {
      const n = value as number;
      return (
        <span className="flex items-center gap-2">
          <input
            id={id}
            type="number"
            value={Number.isNaN(n) ? "" : String(n)}
            min={meta.min}
            max={meta.max}
            onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
            className={`${INPUT} w-36`}
          />
          {meta.unit && <span className="text-xs text-dim">{meta.unit}</span>}
        </span>
      );
    }
    case "bool":
      return (
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 accent-field"
        />
      );
    case "list":
      return <ListInput id={id} label={meta.label} items={(value as string[]) ?? []} onChange={onChange} />;
    case "table":
      return (
        <TableInput id={id} label={meta.label} rows={(value as Record<string, unknown>) ?? {}} onChange={onChange} />
      );
    case "json":
      return (
        <textarea
          id={id}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          rows={Math.min(12, String(value ?? "").split("\n").length + 1)}
          className={`${INPUT} w-full font-mono text-[12px]`}
        />
      );
    case "secret":
      return <SecretInput id={id} value={value} original={original} onChange={onChange} />;
    default:
      return (
        <input
          id={id}
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={`${INPUT} w-full`}
        />
      );
  }
}

function ListInput({ id, label, items, onChange }: { id: string; label: string; items: string[]; onChange: (v: unknown) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item, i) => (
        <span key={`${item}-${i}`} className="flex items-center gap-1 border border-seam bg-ink px-2 py-0.5 text-sm text-phosphor">
          {item}
          <button
            type="button"
            aria-label={`Remove ${item} from ${label}`}
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="px-1 text-dim hover:text-rec focus-visible:outline focus-visible:outline-2 focus-visible:outline-field"
          >
            ×
          </button>
        </span>
      ))}
      <input
        id={id}
        type="text"
        value={draft}
        placeholder="Add..."
        onChange={(e) => setDraft(e.target.value)}
        onBlur={add} /* typed but not Added is still an entry: Save must not drop it */
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        className={`${INPUT} w-40`}
      />
      <button type="button" onClick={add} className={GHOST}>
        Add
      </button>
    </div>
  );
}

function TableInput({
  id,
  label,
  rows,
  onChange,
}: {
  id: string;
  label: string;
  rows: Record<string, unknown>;
  onChange: (v: unknown) => void;
}) {
  const [newKey, setNewKey] = useState("");
  const entries = Object.entries(rows);
  // A new row takes the table's value type: numbers if every value is one.
  const numeric = entries.length > 0 && entries.every(([, v]) => typeof v === "number");
  const add = () => {
    const k = newKey.trim();
    if (!k || k in rows) return;
    onChange({ ...rows, [k]: numeric ? 0 : "" });
    setNewKey("");
  };
  return (
    <div className="grid max-w-xl grid-cols-[1fr_1fr_auto] items-center gap-x-2 gap-y-1">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <span className="truncate font-mono text-xs text-dim">{k}</span>
          <input
            aria-label={`${label}: ${k}`}
            type={typeof v === "number" ? "number" : "text"}
            value={typeof v === "number" && Number.isNaN(v) ? "" : String(v)}
            onChange={(e) =>
              onChange({
                ...rows,
                [k]: typeof v === "number" ? (e.target.value === "" ? NaN : Number(e.target.value)) : e.target.value,
              })
            }
            className={INPUT}
          />
          <button
            type="button"
            aria-label={`Remove row ${k} from ${label}`}
            onClick={() => onChange(Object.fromEntries(entries.filter(([key]) => key !== k)))}
            className="px-1 text-dim hover:text-rec focus-visible:outline focus-visible:outline-2 focus-visible:outline-field"
          >
            ×
          </button>
        </div>
      ))}
      <input
        id={id}
        type="text"
        value={newKey}
        placeholder="New row key"
        onChange={(e) => setNewKey(e.target.value)}
        className={INPUT}
      />
      <button type="button" onClick={add} className={`${GHOST} col-span-2 justify-self-start`}>
        Add row
      </button>
    </div>
  );
}

function SecretInput({
  id,
  value,
  original,
  onChange,
}: {
  id: string;
  value: unknown;
  original: unknown;
  onChange: (v: unknown) => void;
}) {
  const [replacing, setReplacing] = useState(false);
  const isSet = original === SECRET_MASK;
  if (replacing) {
    return (
      <span className="flex items-center gap-2">
        <input
          id={id}
          type="password"
          autoComplete="new-password"
          value={value === SECRET_MASK ? "" : String(value ?? "")}
          onChange={(e) => onChange(e.target.value === "" ? original : e.target.value)}
          className={`${INPUT} w-64`}
        />
        <button
          type="button"
          onClick={() => {
            onChange(original);
            setReplacing(false);
          }}
          className={GHOST}
        >
          Cancel
        </button>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-3">
      <span className="font-mono text-sm text-phosphor">{isSet ? SECRET_MASK : "Not set"}</span>
      <span
        className={`border px-1.5 text-[10px] font-bold uppercase tracking-widest ${
          isSet ? "border-field text-field" : "border-seam text-dim"
        }`}
      >
        {isSet ? "Set" : "Not set"}
      </span>
      {/* the field's id, so the banner can jump to an unset secret; aria-label keeps the field label from renaming it */}
      <button id={id} type="button" aria-label="Replace…" onClick={() => setReplacing(true)} className={GHOST}>
        Replace…
      </button>
    </span>
  );
}

const FIELD_TYPES: FieldType[] = ["number", "text", "bool", "list", "table", "json", "secret"];
const DEFAULTS: Record<FieldType, unknown> = {
  number: 0,
  text: "",
  bool: false,
  list: [],
  table: {},
  json: "{}",
  secret: "",
};
/** The + Add setting form: stages a new key, its type, value and section. */
export function AddSetting({
  sections,
  existing,
  onAdd,
}: {
  sections: string[];
  existing: Record<string, unknown>;
  onAdd: (n: NewField) => void;
}) {
  const defaultSection = sections.includes("Other") ? "Other" : (sections[sections.length - 1] ?? "Other");
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [value, setValue] = useState<unknown>(DEFAULTS.text);
  const [section, setSection] = useState(defaultSection);
  const [err, setErr] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={BUTTON}>
        + Add setting
      </button>
    );
  }

  const meta: FieldMeta = { label: key || "New setting", description: "", section, type };
  const add = () => {
    const e = validateNewKey(key, existing) ?? validateField(meta, value);
    if (e) {
      setErr(e);
      return;
    }
    onAdd({ key, type, section, value });
    setKey("");
    setType("text");
    setValue(DEFAULTS.text);
    setSection(defaultSection);
    setErr(null);
    setOpen(false);
  };

  return (
    <fieldset aria-label="Add setting" className="flex w-full flex-col gap-2 border border-seam bg-ink p-4 text-sm">
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-dim">
          Key
          <input type="text" value={key} onChange={(e) => setKey(e.target.value)} className={INPUT} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-dim">
          Type
          <select
            value={type}
            onChange={(e) => {
              const t = e.target.value as FieldType;
              setType(t);
              setValue(DEFAULTS[t]);
            }}
            className={INPUT}
          >
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-dim">
          Section
          <select value={section} onChange={(e) => setSection(e.target.value)} className={INPUT}>
            {sections.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label htmlFor="new-setting-value" className="text-xs text-dim">
        Value
      </label>
      {type === "secret" ? (
        <input
          id="new-setting-value"
          type="password"
          autoComplete="new-password"
          value={String(value)}
          onChange={(e) => setValue(e.target.value)}
          className={`${INPUT} w-64`}
        />
      ) : (
        <FieldInput key={type} id="new-setting-value" meta={meta} value={value} onChange={setValue} />
      )}
      {err && <p className="text-sm text-rec">{err}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={add} className={BUTTON}>
          Add
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={GHOST}
        >
          Cancel
        </button>
      </div>
    </fieldset>
  );
}
