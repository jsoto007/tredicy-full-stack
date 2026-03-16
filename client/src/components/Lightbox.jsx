import { useEffect, useMemo, useRef, useState } from 'react';
import { resolveApiUrl } from '../lib/api.js';
import { shouldIgnoreHotkeys } from '../lib/hotkeys.js';
import { prefetchImage } from '../lib/image.js';
import ProgressiveImage from './ProgressiveImage.jsx';

const FOCUSABLE_SELECTORS =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container) {
  if (!container) {
    return [];
  }
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTORS));
}

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function Lightbox({ open, image, images = [], startIndex = 0, onClose }) {
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(startIndex || 0);
  const swipeStart = useRef(null);

  const hasCollection = images && images.length > 0;
  const normalizedIndex = useMemo(() => {
    if (!hasCollection) {
      return 0;
    }
    if (activeIndex < 0) {
      return (images.length + (activeIndex % images.length)) % images.length;
    }
    return activeIndex % images.length;
  }, [activeIndex, hasCollection, images.length]);

  const activeImage = useMemo(() => {
    if (hasCollection) {
      return images[normalizedIndex] || image;
    }
    return image;
  }, [hasCollection, image, images, normalizedIndex]);

  useEffect(() => {
    if (open) {
      setActiveIndex(startIndex || 0);
    }
  }, [open, startIndex]);

  useEffect(() => {
    if (!open || !hasCollection || !images.length) {
      return;
    }
    const next = images[(normalizedIndex + 1) % images.length];
    const prev = images[(normalizedIndex - 1 + images.length) % images.length];
    prefetchImage(resolveApiUrl(next?.image_url));
    prefetchImage(resolveApiUrl(prev?.image_url));
  }, [hasCollection, images, normalizedIndex, open]);

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
        onClose?.();
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (hasCollection) {
          setActiveIndex((current) => (current + 1) % images.length);
        }
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (hasCollection) {
          setActiveIndex((current) => (current - 1 + images.length) % images.length);
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open || !activeImage) {
    return null;
  }

  const imageUrl = resolveApiUrl(activeImage.image_url);

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
      onPointerDown={(event) => {
        swipeStart.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={(event) => {
        if (!swipeStart.current || !hasCollection) {
          swipeStart.current = null;
          return;
        }
        const dx = event.clientX - swipeStart.current.x;
        const dy = event.clientY - swipeStart.current.y;
        swipeStart.current = null;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
          if (dx < 0) {
            setActiveIndex((current) => (current + 1) % images.length);
          } else {
            setActiveIndex((current) => (current - 1 + images.length) % images.length);
          }
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
        {hasCollection ? (
          <div className="absolute left-4 top-4 text-xs uppercase tracking-[0.3em] text-gray-400">
            {normalizedIndex + 1} / {images.length}
          </div>
        ) : null}
        <ProgressiveImage
          src={imageUrl}
          alt={activeImage.alt}
          priority
          className="max-h-[80vh] w-full rounded-2xl border border-gray-800 bg-black"
          imageClassName="object-contain"
        />
        <figcaption className="mt-3 text-center text-sm text-gray-300">{activeImage.alt}</figcaption>

        <div className="mt-6 flex justify-center">
          <a
            href="https://www.instagram.com/_melodinails_?igsh=dWV5Y2VoOGd2dzI2&utm_source=qr"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-full border border-gray-700 bg-black/40 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-gray-300 backdrop-blur transition hover:border-gray-500 hover:bg-black/60 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
            aria-label="View more on Instagram"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17" cy="7" r="1.25" />
            </svg>
            <span>View more</span>
          </a>
        </div>

        {hasCollection ? (
          <>
            <button
              type="button"
              onClick={() => setActiveIndex((current) => (current - 1 + images.length) % images.length)}
              className={classNames(
                'absolute left-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-gray-700 bg-black/50 text-gray-200 shadow-soft backdrop-blur transition',
                'hover:border-gray-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black'
              )}
              aria-label="Previous image"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setActiveIndex((current) => (current + 1) % images.length)}
              className={classNames(
                'absolute right-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-gray-700 bg-black/50 text-gray-200 shadow-soft backdrop-blur transition',
                'hover:border-gray-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black'
              )}
              aria-label="Next image"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
        ) : null}
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
