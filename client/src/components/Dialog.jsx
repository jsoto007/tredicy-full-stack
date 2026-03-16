import { useEffect, useId, useRef } from 'react';
import { shouldIgnoreHotkeys } from '../lib/hotkeys.js';

const FOCUSABLE_SELECTORS =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container) {
  if (!container) {
    return [];
  }
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTORS));
}

export default function Dialog({ open, onClose, title, children, footer, className = '' }) {
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previouslyFocused = document.activeElement;

    const focusable = getFocusableElements(dialogRef.current);
    if (focusable.length) {
      focusable[0].focus({ preventScroll: true });
    } else {
      dialogRef.current?.focus({ preventScroll: true });
    }

    function handleKeyDown(event) {
      if (event.key === 'Tab') {
        const elements = getFocusableElements(dialogRef.current);
        if (!elements.length) {
          return;
        }

        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }

      if (shouldIgnoreHotkeys(event)) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current?.();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      role="presentation"
      className={`fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 px-4 py-6 sm:px-6 sm:py-10 ${className}`}
      onMouseDown={(event) => {
        if (event.target === overlayRef.current) {
          onCloseRef.current?.();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl focus:outline-none sm:p-8 md:max-h-[90vh] max-h-[92vh]"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold uppercase tracking-[0.3em] text-gray-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => onCloseRef.current?.()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 text-gray-500 transition hover:border-gray-900 hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            aria-label="Close dialog"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="mt-6 space-y-4 text-sm text-gray-700">{children}</div>
        {footer ? <div className="mt-8 flex flex-wrap justify-end gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}
