import { useCallback, useEffect, useRef, useState } from 'react';
import FadeIn from '../components/FadeIn.jsx';
import ProgressiveImage from '../components/ProgressiveImage.jsx';
import { apiGet, resolveApiUrl } from '../lib/api.js';
import { prefetchImage } from '../lib/image.js';

function Lightbox({ index, images, onClose }) {
  const [activeIndex, setActiveIndex] = useState(index);
  const swipeStart = useRef(null);
  const dialogRef = useRef(null);

  const prev = useCallback(() => setActiveIndex((i) => (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setActiveIndex((i) => (i + 1) % images.length), [images.length]);

  // Prefetch the images on either side so navigation feels instant.
  useEffect(() => {
    if (!images.length) return;
    prefetchImage(images[(activeIndex + 1) % images.length]?.src);
    prefetchImage(images[(activeIndex - 1 + images.length) % images.length]?.src);
  }, [activeIndex, images]);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 px-4 py-10 backdrop-blur-lg"
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
        aria-label="Gallery image viewer"
        className="relative w-full max-w-4xl focus:outline-none"
      >
        <div className="absolute left-4 top-4 z-10 text-[11px] uppercase tracking-[0.3em] text-white/40">
          {activeIndex + 1} / {images.length}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/60 transition hover:border-white/60 hover:text-white focus:outline-none"
          aria-label="Close"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <img
          src={active.src}
          alt={active.alt}
          className="max-h-[80vh] w-full rounded-2xl object-contain"
          decoding="async"
          fetchPriority="high"
        />

        <figcaption className="mt-3 text-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.45em] text-white/40 mr-3">
            {active.category}
          </span>
          <span className="text-sm text-white/50">{active.caption || active.alt}</span>
        </figcaption>

        <button
          type="button"
          onClick={prev}
          className="absolute left-2 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white/80 backdrop-blur transition hover:border-white/50 hover:text-white focus:outline-none"
          aria-label="Previous image"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={next}
          className="absolute right-2 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white/80 backdrop-blur transition hover:border-white/50 hover:text-white focus:outline-none"
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

export default function GalleryPage() {
  const [allItems, setAllItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiGet('/api/gallery?per_page=100'),
      apiGet('/api/gallery/categories')
    ])
      .then(([galleryData, categoryData]) => {
        const items = (galleryData?.items || []).map((item) => ({
          id: item.id,
          src: resolveApiUrl(item.image_url),
          alt: item.alt,
          caption: item.caption,
          category: item.category?.name || 'Other'
        }));
        setAllItems(items);
        const names = Array.from(new Set(items.map((i) => i.category)));
        const orderedNames = (Array.isArray(categoryData) ? categoryData : [])
          .map((c) => c.name)
          .filter((name) => names.includes(name));
        // Include any category not in the ordered list (shouldn't happen, but safe)
        names.forEach((name) => { if (!orderedNames.includes(name)) orderedNames.push(name); });
        setCategories(orderedNames);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = activeCategory === 'All'
    ? allItems
    : allItems.filter((i) => i.category === activeCategory);

  return (
    <>
      {/* Page header */}
      <div className="bg-ts-charcoal py-16 text-center">
        <FadeIn immediate className="mx-auto max-w-2xl space-y-3 px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.5em] text-ts-gold">
            Tredici Social
          </p>
          <h1 className="font-heading text-5xl font-medium text-white">Gallery</h1>
          <p className="text-sm text-ts-light-text/70">
            Food, space, and atmosphere — a look inside our kitchen and dining room.
          </p>
        </FadeIn>
      </div>

      <main className="bg-ts-linen">
        {/* Category filter */}
        <div className="sticky top-[68px] z-10 border-b border-ts-stone bg-ts-linen/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-6 py-3 scrollbar-none">
            {['All', ...categories].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 rounded-full px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] transition ${
                  activeCategory === cat
                    ? 'bg-ts-crimson text-white'
                    : 'border border-ts-stone text-ts-muted hover:border-ts-crimson hover:text-ts-crimson'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Masonry grid */}
        <div className="mx-auto max-w-7xl px-6 py-12">
          {loading ? (
            <div className="flex justify-center py-24">
              <span className="text-[11px] uppercase tracking-[0.4em] text-ts-muted">Loading…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex justify-center py-24">
              <span className="text-[11px] uppercase tracking-[0.4em] text-ts-muted">No photos yet.</span>
            </div>
          ) : (
            <FadeIn
              className="columns-2 gap-4 md:columns-3 lg:columns-4"
              childClassName="mb-4 break-inside-avoid"
              delayStep={0.06}
            >
              {filtered.map((image, idx) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setLightboxIndex(allItems.indexOf(image))}
                  className="group relative block w-full overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ts-crimson focus-visible:ring-offset-2"
                  style={{ aspectRatio: idx % 3 === 0 ? '3/4' : idx % 3 === 1 ? '1/1' : '4/3' }}
                  aria-label={`View: ${image.alt}`}
                >
                  <ProgressiveImage
                    src={image.src}
                    alt={image.alt}
                    className="h-full w-full"
                    imageClassName="object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-transparent to-transparent p-4 opacity-0 transition duration-300 group-hover:opacity-100">
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-[0.4em] text-white/70">
                        {image.category}
                      </p>
                      <p className="mt-0.5 font-heading text-sm font-medium text-white">
                        {image.caption || image.alt}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </FadeIn>
          )}
        </div>
      </main>

      {lightboxIndex !== null && (
        <Lightbox
          index={lightboxIndex}
          images={allItems}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
