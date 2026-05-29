import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ConfirmDialogState } from "../types";
import { StatusBanner } from "./Common";

export function ModalShell({
  title,
  children,
  onClose,
  closeDisabled = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = getFocusableElements(panelRef.current);
    focusable[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !closeDisabled) {
        event.preventDefault();
        onClose();
      }

      if (event.key !== "Tab") {
        return;
      }

      const elements = getFocusableElements(panelRef.current);
      if (elements.length === 0) {
        event.preventDefault();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [closeDisabled, onClose]);

  return (
    <div
      className="modal-backdrop lifeos-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (!closeDisabled && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section className="modal-panel lifeos-dialog" role="dialog" aria-modal="true" aria-label={title} ref={panelRef}>
        {children}
      </section>
    </div>
  );
}

export function ConfirmDialog({
  dialog,
  busy,
  errorMessage,
  onCancel,
  onConfirm,
}: {
  dialog: ConfirmDialogState;
  busy: boolean;
  errorMessage?: string;
  onCancel: () => void;
  onConfirm: (password?: string) => void;
}) {
  const [phrase, setPhrase] = useState("");
  const [password, setPassword] = useState("");
  const phraseMatches = !dialog.requiredPhrase || phrase === dialog.requiredPhrase;
  const passwordReady = !dialog.passwordRequired || password.length > 0;
  const canConfirm = phraseMatches && passwordReady;

  return (
    <ModalShell title={dialog.title} onClose={onCancel} closeDisabled={busy}>
      <div className="confirm-dialog-content">
        <div>
          <p className="eyebrow">{dialog.variant === "destructive" ? "Confirm destructive action" : "Confirm action"}</p>
          <h3>{dialog.title}</h3>
          <p>{dialog.description}</p>
          {dialog.requiredPhrase ? (
            <label className="confirm-phrase-field">
              Type {dialog.requiredPhrase} to continue
              <input value={phrase} onChange={(event) => setPhrase(event.target.value)} autoComplete="off" />
            </label>
          ) : null}
          {dialog.passwordRequired ? (
            <label className="confirm-phrase-field">
              {dialog.passwordLabel ?? "Password"}
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder={dialog.passwordPlaceholder ?? ""}
              />
            </label>
          ) : null}
          {errorMessage ? <StatusBanner tone="error" message={errorMessage} /> : null}
        </div>
        <div className="modal-actions">
          <button className="secondary-button" type="button" disabled={busy} onClick={onCancel}>
            {dialog.cancelLabel}
          </button>
          <button
            className={dialog.variant === "destructive" ? "primary-button destructive-confirm-button" : "primary-button"}
            type="button"
            disabled={busy || !canConfirm}
            onClick={() => onConfirm(password)}
          >
            {busy ? "Working..." : dialog.confirmLabel}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function getFocusableElements(container: HTMLElement | null) {
  if (!container) {
    return [];
  }

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute("aria-hidden"));
}
