import { useCallback, useEffect, useRef, useState } from 'react';
import FadeIn from '../components/FadeIn.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import greenNails from '../assets/melodi/greenNails.jpg';
import whiteNails from '../assets/melodi/whiteNails.jpg';
import fullSet from '../assets/melodi/fullSet.jpg';
import russianManicure from '../assets/melodi/russianManicure.png';
import russianManicureTwo from '../assets/melodi/russianManicure2.jpg';
import gelPedicure from '../assets/melodi/gelPedicure.jpg';

const INSTAGRAM_URL =
  'https://www.instagram.com/_melodinails_?igsh=dWV5Y2VoOGd2dzI2&utm_source=qr';

const galleryImages = [
  { src: fullSet, alt: 'Full acrylic set with neutral tones' },
  { src: greenNails, alt: 'Green manicure detail' },
  { src: whiteNails, alt: 'Classic white manicure' },
  { src: russianManicure, alt: 'Russian manicure service detail' },
  { src: russianManicureTwo, alt: 'Refined manicure close-up' },
  { src: gelPedicure, alt: 'Gel pedicure result' },
];

function GalleryLightbox({ index, images, onClose }) {
  const [activeIndex, setActiveIndex] = useState(index);
  const swipeStart = useRef(null);
  const dialogRef = useRef(null);

  const prev = useCallback(() => {
    setActiveIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const next = useCallback(() => {
    setActiveIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    dialogRef.current?.focus({ preventScroll: true });

    function handleKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    }
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-10 backdrop-blur-md"
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
        {/* Counter */}
        <div className="absolute left-4 top-4 z-10 text-xs uppercase tracking-[0.3em] text-gray-300">
          {activeIndex + 1} / {images.length}
        </div>

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/80 transition hover:border-white/60 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          aria-label="Close"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {/* Image */}
        <img
          src={active.src}
          alt={active.alt}
          className="max-h-[78vh] w-full rounded-2xl object-contain"
        />
        <figcaption className="mt-3 text-center text-sm text-gray-400">{active.alt}</figcaption>

        {/* Instagram CTA */}
        <div className="mt-5 flex justify-center">
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="View more on Instagram"
            className="flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-gray-300 backdrop-blur transition hover:border-white/50 hover:bg-black/60 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17" cy="7" r="1.25" />
            </svg>
            View more on Instagram
          </a>
        </div>

        {/* Prev */}
        <button
          type="button"
          onClick={prev}
          className="absolute left-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white/80 backdrop-blur transition hover:border-white/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          aria-label="Previous image"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Next */}
        <button
          type="button"
          onClick={next}
          className="absolute right-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white/80 backdrop-blur transition hover:border-white/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
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
    <section id="work" className="bg-[#fffaf5] py-16 text-[#23301d]">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6">
        <SectionTitle
          eyebrow="Gallery"
          title="A closer look at Melodi Nails"
          description="Close-up nail imagery from the studio — tap any photo to expand."
        />

        {/* Mobile: 2-column staggered grid — matches hero style */}
        <div className="grid grid-cols-2 gap-4 lg:hidden">
          {galleryImages.map((image, idx) => (
            <button
              key={image.alt}
              type="button"
              onClick={() => setLightboxIndex(idx)}
              className={`group block w-full overflow-hidden rounded-[2rem] border border-white/60 shadow-[0_22px_50px_rgba(42,57,35,0.13)] transition duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6f7863] focus-visible:ring-offset-2${idx % 2 !== 0 ? ' mt-10' : ''}`}
              aria-label={`View ${image.alt}`}
            >
              <img
                src={image.src}
                alt={image.alt}
                className="w-full object-cover transition duration-500 group-hover:scale-105"
              />
            </button>
          ))}
        </div>

        {/* Desktop: masonry columns */}
        <FadeIn className="hidden columns-3 gap-5 lg:block" childClassName="mb-5 break-inside-avoid" delayStep={0.08}>
          {galleryImages.map((image, idx) => (
            <button
              key={image.alt}
              type="button"
              onClick={() => setLightboxIndex(idx)}
              className="group block w-full overflow-hidden rounded-[2rem] border border-[#e0d2c3] bg-white/90 shadow-[0_18px_40px_rgba(42,57,35,0.08)] transition duration-300 hover:shadow-[0_22px_50px_rgba(42,57,35,0.16)] hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6f7863] focus-visible:ring-offset-2"
              aria-label={`View ${image.alt}`}
            >
              <img
                src={image.src}
                alt={image.alt}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
            </button>
          ))}
        </FadeIn>

        {/* Instagram CTA */}
        <div className="flex justify-center">
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="View more nail photos on Instagram"
            className="inline-flex items-center gap-3 rounded-full border border-[#c8af8f] bg-transparent px-7 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#6f7863] transition hover:bg-[#f3e7d9] hover:text-[#2a3923] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6f7863] focus-visible:ring-offset-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-4 w-4 shrink-0"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17" cy="7" r="1.25" />
            </svg>
            View more on Instagram
          </a>
        </div>
      </div>

      {lightboxIndex !== null && (
        <GalleryLightbox
          index={lightboxIndex}
          images={galleryImages}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </section>
  );
}
