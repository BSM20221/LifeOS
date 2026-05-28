import { useEffect, useRef, type ReactNode } from "react";
import type { ConfirmDialogState } from "../types";

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
  onCancel,
  onConfirm,
}: {
  dialog: ConfirmDialogState;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalShell title={dialog.title} onClose={onCancel} closeDisabled={busy}>
      <div className="confirm-dialog-content">
        <div>
          <p className="eyebrow">{dialog.variant === "destructive" ? "Confirm destructive action" : "Confirm action"}</p>
          <h3>{dialog.title}</h3>
          <p>{dialog.description}</p>
        </div>
        <div className="modal-actions">
          <button className="secondary-button" type="button" disabled={busy} onClick={onCancel}>
            {dialog.cancelLabel}
          </button>
          <button className={dialog.variant === "destructive" ? "primary-button destructive-confirm-button" : "primary-button"} type="button" disabled={busy} onClick={onConfirm}>
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
