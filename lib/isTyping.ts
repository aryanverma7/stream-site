/** Typing in a field: Esc and single-key shortcuts there belong to the field (or the IME). */
export function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return e.isComposing || !!t?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t?.tagName ?? "");
}
