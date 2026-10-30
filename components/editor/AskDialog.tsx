"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

/**
 * The site's own confirm and prompt, in place of window.confirm/prompt
 * (which block the page, ignore the site's look and cannot be styled as
 * dangerous). `useAsk()` returns the dialog to render plus two functions
 * that resolve when the person answers:
 *
 *   const ask = useAsk();
 *   if (!(await ask.confirm({ title: "Start over?", confirmLabel: "Start over" }))) return;
 *   const name = await ask.prompt({ title: "New name", label: "Name", initial: p.name });
 *   ...
 *   return <>{...}{ask.dialog}</>;
 *
 * Keyboard: focus moves into the dialog (the field, or Cancel for a plain
 * confirm, so Enter never confirms something dangerous by accident), Tab
 * stays inside it, Esc cancels, and focus goes back to whatever opened it.
 * Esc is caught on window in the capture phase, like DeleteDialog's, so it
 * never also zooms out of the view behind.
 */
export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Red confirm button: the action loses something or cannot be undone. */
  danger?: boolean;
}
export interface PromptOptions extends ConfirmOptions {
  /** The field's accessible label. */
  label: string;
  initial?: string;
}

type Open = (ConfirmOptions & { label?: string; initial?: string }) & { resolve: (v: string | null) => void };

export function useAsk() {
  const [open, setOpen] = useState<Open | null>(null);
  const ask = useCallback(
    (o: ConfirmOptions & { label?: string; initial?: string }) => new Promise<string | null>((resolve) => setOpen({ ...o, resolve })),
    [],
  );
  const confirm = useCallback((o: ConfirmOptions) => ask(o).then((v) => v !== null), [ask]);
  /** The trimmed answer, or null for Cancel/Esc. */
  const prompt = useCallback((o: PromptOptions) => ask(o).then((v) => (v === null ? null : v.trim())), [ask]);
  const close = useCallback(
    (v: string | null) => {
      open?.resolve(v);
      setOpen(null);
    },
    [open],
  );
  const dialog = open ? <AskDialog {...open} onClose={close} /> : null;
  return { dialog, confirm, prompt };
}

const FOCUSABLE =
  "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex='-1'])";

function AskDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  danger,
  label,
  initial = "",
  onClose,
}: ConfirmOptions & { label?: string; initial?: string; onClose: (v: string | null) => void }) {
  const isPrompt = label !== undefined;
  const [value, setValue] = useState(initial);
  const panel = useRef<HTMLFormElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const messageId = useId();

  // Focus in on open, back to the opener on close (if it is still on the page).
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    if (isPrompt) fieldRef.current?.select();
    (isPrompt ? fieldRef.current : cancelRef.current)?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, [isPrompt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onClose(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const trap = (e: ReactKeyboardEvent) => {
    if (e.key !== "Tab" || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const empty = isPrompt && !value.trim();
  return (
    <div
      className="dialog-backdrop fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose(null);
      }}
    >
      <form
        ref={panel}
        role={isPrompt ? "dialog" : "alertdialog"}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? messageId : undefined}
        onKeyDown={trap}
        onSubmit={(e) => {
          e.preventDefault();
          if (!empty) onClose(isPrompt ? value : "");
        }}
        className={`dialog-in w-full max-w-md space-y-4 border bg-bezel p-5 ${danger ? "border-rec" : "border-seam"}`}
      >
        <h3 id={titleId} className="stencil text-3xl text-phosphor">
          {title}
        </h3>
        {message && (
          <p id={messageId} className="text-sm text-dim">
            {message}
          </p>
        )}
        {isPrompt && (
          <input
            ref={fieldRef}
            aria-label={label}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full border border-seam bg-ink px-3 py-2 text-sm text-phosphor focus:border-field focus:outline-none"
          />
        )}
        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onClose(null)}
            className="label border border-seam px-4 py-2 text-sm text-phosphor transition-colors hover:border-field"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            disabled={empty}
            className={`label border px-4 py-2 text-sm text-ink transition-opacity disabled:opacity-40 ${danger ? "border-rec bg-rec" : "border-field bg-field"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
