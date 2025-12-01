import { useEffect, useRef } from 'react';
import { resolveApiUrl } from '../lib/api.js';
import ProgressiveImage from './ProgressiveImage.jsx';

const FOCUSABLE_SELECTORS =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container) {
  if (!container) {
    return [];
  }
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTORS));
}

export default function Lightbox({ open, image, onClose }) {
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previouslyFocused = document.activeElement;
    const focusables = getFocusableElements(dialogRef.current);
    if (focusables.length) {
      focusables[0].focus({ preventScroll: true });
    } else {
      dialogRef.current?.focus({ preventScroll: true });
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
      }

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
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open || !image) {
    return null;
  }

  const imageUrl = resolveApiUrl(image.image_url);

  return (
    <div
      ref={overlayRef}
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-6 py-12"
      onMouseDown={(event) => {
        if (event.target === overlayRef.current) {
          onClose?.();
        }
      }}
    >
      <figure
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Expanded gallery image"
        className="relative w-full max-w-4xl focus:outline-none"
      >
        <ProgressiveImage
          src={imageUrl}
          alt={image.alt}
          priority
          className="max-h-[80vh] w-full rounded-2xl border border-gray-800 bg-black"
          imageClassName="object-contain"
        />
        <figcaption className="mt-4 text-center text-sm text-gray-400">{image.alt}</figcaption>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-700 text-gray-200 transition hover:border-gray-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          aria-label="Close lightbox"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </figure>
    </div>
  );
}
