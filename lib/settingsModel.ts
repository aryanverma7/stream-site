// Pure settings logic; mirrors mac mini/Stream/config_schema.py.
export const SECRET_MASK = "••••••••";

export type FieldType = "number" | "text" | "bool" | "list" | "table" | "json" | "secret";
export type FieldMeta = {
  label: string;
  description: string;
  section: string;
  type: FieldType;
  unit?: string;
  min?: number;
  max?: number;
  // true: flag while empty; a key name: flag while empty and that bool setting is on.
  needed?: boolean | string;
};
export type Schema = { sections: string[]; fields: Record<string, FieldMeta> };
export type NewField = { key: string; type: FieldType; section: string; value: unknown };

const KEY_RE = /^[a-z][a-z0-9_]*$/;

export function groupBySection(schema: Schema): { section: string; keys: string[] }[] {
  return schema.sections
    .map((section) => ({
      section,
      keys: Object.keys(schema.fields)
        .filter((k) => schema.fields[k].section === section)
        .sort((a, b) => schema.fields[a].label.localeCompare(schema.fields[b].label)),
    }))
    .filter((g) => g.keys.length > 0);
}

export function searchFields(schema: Schema, query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return Object.keys(schema.fields).filter((k) => {
    const m = schema.fields[k];
    return [k, m.label, m.description].some((s) => s.toLowerCase().includes(q));
  });
}

const isEmpty = (v: unknown) =>
  v === undefined || v === null || v === "" ||
  (Array.isArray(v) ? v.length === 0 : typeof v === "object" && Object.keys(v as object).length === 0);

/** Needed settings that are still empty, in section order. A masked secret counts as filled. */
export function missingFields(schema: Schema, config: Record<string, unknown>): string[] {
  return groupBySection(schema)
    .flatMap((g) => g.keys)
    .filter((k) => {
      const need = schema.fields[k].needed;
      return (need === true || (typeof need === "string" && config[need] === true)) && isEmpty(config[k]);
    });
}

const isSimple = (v: unknown) =>
  typeof v === "number" ? Number.isFinite(v) : ["string", "boolean"].includes(typeof v);

export function validateField(meta: FieldMeta, value: unknown): string | null {
  const unit = meta.unit ? ` ${meta.unit}` : "";
  switch (meta.type) {
    case "number":
      if (typeof value !== "number") return "Must be a number";
      if (!Number.isFinite(value)) return "Must be a finite number";
      if (meta.min !== undefined && value < meta.min) return `Must be ${meta.min}${unit} or more`;
      if (meta.max !== undefined && value > meta.max) return `Must be ${meta.max}${unit} or less`;
      return null;
    case "bool":
      return typeof value === "boolean" ? null : "Must be true or false";
    case "list":
      return Array.isArray(value) && value.every((v) => typeof v === "string")
        ? null
        : "Must be a list of text values";
    case "table":
      return value !== null && typeof value === "object" && !Array.isArray(value) &&
        Object.values(value).every(isSimple)
        ? null
        : "Must be a table of simple values";
    case "text":
    case "secret":
      return typeof value === "string" ? null : "Must be text";
    case "json":
      if (typeof value === "string") {
        try {
          JSON.parse(value);
        } catch {
          return "Not valid JSON";
        }
      }
      return null;
  }
}

export function validateNewKey(key: string, existing: Record<string, unknown>): string | null {
  if (!KEY_RE.test(key)) return "Key must be lowercase letters, digits and underscores";
  if (key in existing) return "That key already exists";
  return null;
}

export function changedKeys(original: Record<string, unknown>, edited: Record<string, unknown>): string[] {
  return Object.keys(edited).filter(
    (k) => !(k in original) || JSON.stringify(original[k]) !== JSON.stringify(edited[k]),
  );
}

// Callers must validate every field first: invalid json text (edited or new) makes JSON.parse throw.
export function buildPayload(
  original: Record<string, unknown>,
  edited: Record<string, unknown>,
  newFields: NewField[],
  schema: Schema,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of changedKeys(original, edited)) {
    const v = edited[k];
    if (v === SECRET_MASK) continue;
    out[k] = schema.fields[k]?.type === "json" && typeof v === "string" ? JSON.parse(v) : v;
  }
  if (newFields.length) {
    const custom = { ...((original._custom_fields as Record<string, unknown>) ?? {}) };
    for (const n of newFields) {
      out[n.key] = n.type === "json" && typeof n.value === "string" ? JSON.parse(n.value) : n.value;
      custom[n.key] = { type: n.type, section: n.section };
    }
    out._custom_fields = custom;
  }
  return out;
}
