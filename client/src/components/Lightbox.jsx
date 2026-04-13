import { useEffect, useMemo, useRef, useState } from 'react';
import { resolveApiUrl } from '../lib/api.js';
import { shouldIgnoreHotkeys } from '../lib/hotkeys.js';
import { prefetchImage } from '../lib/image.js';

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

const INSTAGRAM_URL = 'https://www.instagram.com/tredici.social/';

export default function Lightbox({ open, image, images = [], startIndex = 0, onClose, instagramUrl = INSTAGRAM_URL }) {
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(startIndex || 0);
  const [imageLoaded, setImageLoaded] = useState(false);
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

  const imageUrl = open && activeImage ? resolveApiUrl(activeImage.image_url) : null;

  // Reset loaded state whenever the displayed image changes.
  useEffect(() => {
    setImageLoaded(false);
  }, [imageUrl]);

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
        className="relative flex w-full max-w-4xl flex-col items-center gap-3 focus:outline-none"
      >
        {/* Counter */}
        {hasCollection ? (
          <div className="self-start text-[11px] uppercase tracking-[0.3em] text-white/40">
            {normalizedIndex + 1} / {images.length}
          </div>
        ) : null}

        {/* Image container — sizes naturally, capped by the viewport */}
        <div className="relative flex w-full items-center justify-center">
          {/* Loading spinner */}
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="h-8 w-8 animate-spin text-white/30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
          <img
            key={imageUrl}
            src={imageUrl}
            alt={activeImage.alt}
            fetchPriority="high"
            decoding="async"
            onLoad={() => setImageLoaded(true)}
            className={classNames(
              'max-h-[80vh] w-auto max-w-full rounded-2xl object-contain transition-opacity duration-300',
              imageLoaded ? 'opacity-100' : 'opacity-0'
            )}
          />

          {/* Navigation arrows — centered on the image area */}
          {hasCollection ? (
            <>
              <button
                type="button"
                onClick={() => setActiveIndex((current) => (current - 1 + images.length) % images.length)}
                className={classNames(
                  'absolute left-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white/80 backdrop-blur transition',
                  'hover:border-white/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40'
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
                  'absolute right-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white/80 backdrop-blur transition',
                  'hover:border-white/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40'
                )}
                aria-label="Next image"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </>
          ) : null}
        </div>

        <figcaption className="text-center text-sm text-white/50">{activeImage.alt}</figcaption>

        <div className="flex justify-center">
          <a
            href={instagramUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-5 py-2 text-[11px] font-semibold uppercase tracking-widest text-white/50 backdrop-blur transition hover:border-white/40 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
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

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-2 -top-2 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/60 transition hover:border-white/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
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
