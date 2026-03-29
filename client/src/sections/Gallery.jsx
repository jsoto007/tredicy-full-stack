import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import FadeIn from '../components/FadeIn.jsx';
import SectionTitle from '../components/SectionTitle.jsx';

// Replace these with real Tredici Social food/interior/bar photography.
// Each item: { src: string | null, alt: string, color: string (fallback gradient) }
const GALLERY_ITEMS = [
  { src: null, alt: 'Tagliatelle al Ragù — slow-braised Wagyu', color: 'linear-gradient(135deg, #6B1528 0%, #9B2335 100%)' },
  { src: null, alt: 'Tredici Social dining room', color: 'linear-gradient(135deg, #2E1F18 0%, #1C1410 100%)' },
  { src: null, alt: 'Burrata con Prosciutto', color: 'linear-gradient(135deg, #BFA882 0%, #8A6E4A 100%)' },
  { src: null, alt: 'The bar at Tredici Social', color: 'linear-gradient(135deg, #1C1410 0%, #3a2218 100%)' },
  { src: null, alt: 'Costata di Manzo — dry-aged ribeye', color: 'linear-gradient(135deg, #9B2335 0%, #6B1528 100%)' },
  { src: null, alt: 'Tiramisù della Casa', color: 'linear-gradient(135deg, #3a2218 0%, #BFA882 100%)' },
];

function Lightbox({ index, images, onClose }) {
  const [activeIndex, setActiveIndex] = useState(index);
  const swipeStart = useRef(null);
  const dialogRef = useRef(null);

  const prev = useCallback(() => setActiveIndex((i) => (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setActiveIndex((i) => (i + 1) % images.length), [images.length]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    dialogRef.current?.focus({ preventScroll: true });
    const handleKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [onClose, next, prev]);

  const active = images[activeIndex];

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4 py-10 backdrop-blur-md"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onPointerDown={(e) => { swipeStart.current = { x: e.clientX }; }}
      onPointerUp={(e) => {
        if (!swipeStart.current) return;
        const dx = e.clientX - swipeStart.current.x;
        swipeStart.current = null;
        if (Math.abs(dx) > 40) dx < 0 ? next() : prev();
      }}
    >
      <figure
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Gallery image"
        className="relative w-full max-w-3xl focus:outline-none"
      >
        <div className="absolute left-4 top-4 z-10 text-[11px] uppercase tracking-[0.3em] text-white/50">
          {activeIndex + 1} / {images.length}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/70 transition hover:border-white/60 hover:text-white focus:outline-none"
          aria-label="Close gallery"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {active.src ? (
          <img src={active.src} alt={active.alt} className="max-h-[78vh] w-full rounded-2xl object-contain" />
        ) : (
          <div
            className="flex h-[50vh] w-full items-center justify-center rounded-2xl"
            style={{ background: active.color }}
            aria-label={active.alt}
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.4em] text-white/60">
              {active.alt}
            </span>
          </div>
        )}

        <figcaption className="mt-3 text-center text-sm text-white/50">{active.alt}</figcaption>

        <button
          type="button"
          onClick={prev}
          className="absolute left-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white/80 backdrop-blur transition hover:border-white/50 hover:text-white focus:outline-none"
          aria-label="Previous image"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <button
          type="button"
          onClick={next}
          className="absolute right-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white/80 backdrop-blur transition hover:border-white/50 hover:text-white focus:outline-none"
          aria-label="Next image"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </figure>
    </div>
  );
}

export default function Gallery() {
  const [lightboxIndex, setLightboxIndex] = useState(null);

  return (
    <section id="gallery" className="bg-ts-linen py-20">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionTitle
            eyebrow="Gallery"
            title="A taste of the experience"
            description="Food, space, and atmosphere — a look inside Tredici Social."
          />
          <Link
            to="/gallery"
            className="shrink-0 inline-flex items-center gap-2 rounded-full border border-ts-stone px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-ts-muted transition hover:border-ts-crimson hover:text-ts-crimson"
          >
            View all photos
          </Link>
        </div>

        {/* Grid */}
        <FadeIn
          className="grid grid-cols-2 gap-4 md:grid-cols-3"
          childClassName="aspect-square"
          delayStep={0.08}
        >
          {GALLERY_ITEMS.map((image, idx) => (
            <button
              key={image.alt}
              type="button"
              onClick={() => setLightboxIndex(idx)}
              className="group relative h-full w-full overflow-hidden rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ts-crimson focus-visible:ring-offset-2"
              aria-label={`View: ${image.alt}`}
            >
              {image.src ? (
                <img
                  src={image.src}
                  alt={image.alt}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              ) : (
                <div
                  className="h-full w-full transition duration-500 group-hover:scale-105"
                  style={{ background: image.color }}
                  aria-hidden="true"
                />
              )}
              {/* Overlay on hover */}
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-transparent to-transparent p-4 opacity-0 transition duration-300 group-hover:opacity-100">
                <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/90">
                  {image.alt}
                </span>
              </div>
            </button>
          ))}
        </FadeIn>
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          index={lightboxIndex}
          images={GALLERY_ITEMS}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </section>
  );
}
