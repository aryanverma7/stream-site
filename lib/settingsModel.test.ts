import { describe, it, expect } from "vitest";
import {
  SECRET_MASK,
  buildPayload,
  changedKeys,
  groupBySection,
  missingFields,
  searchFields,
  validateField,
  validateNewKey,
  type FieldMeta,
  type Schema,
} from "@/lib/settingsModel";

const f = (over: Partial<FieldMeta>): FieldMeta => ({
  label: "L", description: "", section: "A", type: "text", ...over,
});

const schema: Schema = {
  sections: ["B", "A", "Empty"],
  fields: {
    z_key: f({ label: "Zed", section: "A" }),
    a_key: f({ label: "Alpha", section: "A" }),
    b_key: f({ label: "Beta", section: "B", description: "Greets people in chat" }),
    github_client_secret: f({ label: "Secret", section: "B", type: "secret" }),
    cfg: f({ label: "Cfg", section: "B", type: "json" }),
  },
};

describe("groupBySection", () => {
  it("drops empty sections and keeps section order", () => {
    const g = groupBySection(schema);
    expect(g.map((s) => s.section)).toEqual(["B", "A"]);
    expect(g[1].keys).toEqual(["a_key", "z_key"]);
  });
});

describe("searchFields", () => {
  it("matches description text", () => {
    expect(searchFields(schema, "chat")).toEqual(["b_key"]);
  });
  it("matches key and label case-insensitively; empty returns []", () => {
    expect(searchFields(schema, "ALPHA")).toEqual(["a_key"]);
    expect(searchFields(schema, "z_k")).toEqual(["z_key"]);
    expect(searchFields(schema, "")).toEqual([]);
  });
});

describe("validateField", () => {
  it("enforces min with unit", () => {
    expect(validateField(f({ type: "number", min: 5, unit: "seconds" }), 1)).toBe("Must be 5 seconds or more");
  });
  it("enforces max, unit omitted when absent", () => {
    expect(validateField(f({ type: "number", max: 9 }), 10)).toBe("Must be 9 or less");
  });
  it("rejects non-finite and non-number", () => {
    const m = f({ type: "number" });
    expect(validateField(m, NaN)).toBe("Must be a finite number");
    expect(validateField(m, Infinity)).toBe("Must be a finite number");
    expect(validateField(m, -Infinity)).toBe("Must be a finite number");
    expect(validateField(m, "3")).toBe("Must be a number");
    expect(validateField(m, true)).toBe("Must be a number");
    expect(validateField(m, 3)).toBeNull();
  });
  it("checks bool, list, table, text", () => {
    expect(validateField(f({ type: "bool" }), 1)).toBe("Must be true or false");
    expect(validateField(f({ type: "list" }), [1])).toBe("Must be a list of text values");
    expect(validateField(f({ type: "list" }), ["a"])).toBeNull();
    expect(validateField(f({ type: "table" }), { a: [] })).toBe("Must be a table of simple values");
    expect(validateField(f({ type: "table" }), [1])).toBe("Must be a table of simple values");
    expect(validateField(f({ type: "table" }), { a: 1 })).toBeNull();
    expect(validateField(f({ type: "table" }), { a: NaN })).toBe("Must be a table of simple values");
    expect(validateField(f({ type: "text" }), 1)).toBe("Must be text");
    expect(validateField(f({ type: "secret" }), 1)).toBe("Must be text");
  });
  it("flags invalid JSON text for json fields", () => {
    expect(validateField(f({ type: "json" }), "{nope")).toBe("Not valid JSON");
    expect(validateField(f({ type: "json" }), '{"a":1}')).toBeNull();
  });
});

describe("validateNewKey", () => {
  it("checks format and duplicates", () => {
    expect(validateNewKey("Bad-Key", {})).toBe("Key must be lowercase letters, digits and underscores");
    expect(validateNewKey("1abc", {})).toBe("Key must be lowercase letters, digits and underscores");
    expect(validateNewKey("a", { a: 1 })).toBe("That key already exists");
    expect(validateNewKey("good_key2", {})).toBeNull();
  });
});

describe("changedKeys", () => {
  it("lists differing and new keys", () => {
    expect(changedKeys({ a: 1, b: [1] }, { a: 1, b: [2], c: 3 })).toEqual(["b", "c"]);
  });
});

describe("buildPayload", () => {
  it("omits untouched secrets", () => {
    const o = { github_client_secret: SECRET_MASK };
    expect(buildPayload(o, { ...o }, [], schema)).toEqual({});
  });
  it("sends a replaced secret", () => {
    expect(
      buildPayload({ github_client_secret: SECRET_MASK }, { github_client_secret: "newvalue" }, [], schema),
    ).toEqual({ github_client_secret: "newvalue" });
  });
  it("sends only changed keys", () => {
    expect(buildPayload({ a: 1, b: 2 }, { a: 1, b: 3 }, [], schema)).toEqual({ b: 3 });
  });
  it("parses json text when the schema says json", () => {
    expect(buildPayload({ cfg: { a: 1 } }, { cfg: '{"a":2}' }, [], schema)).toEqual({ cfg: { a: 2 } });
  });
  it("parses json text into a nested object", () => {
    expect(buildPayload({ cfg: {} }, { cfg: '{"a": [1]}' }, [], schema)).toEqual({ cfg: { a: [1] } });
  });
  it("throws on invalid json text (callers validate first)", () => {
    expect(() => buildPayload({ cfg: {} }, { cfg: "{nope" }, [], schema)).toThrow();
    expect(() =>
      buildPayload({}, {}, [{ key: "n", type: "json", section: "Other", value: "{nope" }], schema),
    ).toThrow();
  });
  it("merges custom field metadata", () => {
    const p = buildPayload(
      { _custom_fields: { a: { type: "text", section: "Other" } }, a: "x" },
      { _custom_fields: { a: { type: "text", section: "Other" } }, a: "x" },
      [{ key: "b", type: "number", section: "Other", value: 5 }],
      schema,
    );
    expect(p).toEqual({
      b: 5,
      _custom_fields: {
        a: { type: "text", section: "Other" },
        b: { type: "number", section: "Other" },
      },
    });
  });
});

describe("missingFields", () => {
  const f = (section: string, needed?: boolean | string, type: FieldMeta["type"] = "text"): FieldMeta =>
    ({ label: "L", description: "", section, type, needed });
  const schema: Schema = {
    sections: ["A", "B"],
    fields: {
      token: f("B", true, "secret"),
      users: f("A", true, "list"),
      bot: f("B", "dm_on", "secret"),
      dm_on: f("B", undefined, "bool"),
      extra: f("A"),
    },
  };

  it("lists empty needed settings in section order and skips filled, masked or optional ones", () => {
    expect(missingFields(schema, { token: "", users: [], bot: "", dm_on: false, extra: "" })).toEqual(["users", "token"]);
    expect(missingFields(schema, { token: SECRET_MASK, users: ["me"], bot: "", dm_on: false })).toEqual([]);
  });

  it("flags a conditional setting only while its switch is on", () => {
    expect(missingFields(schema, { token: SECRET_MASK, users: ["me"], bot: "", dm_on: true })).toEqual(["bot"]);
  });

  it("treats an absent key as empty", () => {
    expect(missingFields(schema, { users: ["me"] })).toEqual(["token"]);
  });
});
