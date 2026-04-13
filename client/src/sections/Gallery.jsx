import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import FadeIn from '../components/FadeIn.jsx';
import Lightbox from '../components/Lightbox.jsx';
import ProgressiveImage from '../components/ProgressiveImage.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import { apiGet, resolveApiUrl } from '../lib/api.js';
import { thumbUrl } from '../lib/image.js';

const INSTAGRAM_URL = 'https://www.instagram.com/tredici.social/';

// Fallback placeholders shown while loading or when fewer than 6 photos are placed.
const FALLBACK_ITEMS = [
  { src: null, alt: 'Tagliatelle al Ragù — slow-braised Wagyu', color: 'linear-gradient(135deg, #6B1528 0%, #9B2335 100%)' },
  { src: null, alt: 'Tredici Social dining room', color: 'linear-gradient(135deg, #2E1F18 0%, #1C1410 100%)' },
  { src: null, alt: 'Burrata con Prosciutto', color: 'linear-gradient(135deg, #BFA882 0%, #8A6E4A 100%)' },
  { src: null, alt: 'The bar at Tredici Social', color: 'linear-gradient(135deg, #1C1410 0%, #3a2218 100%)' },
  { src: null, alt: 'Costata di Manzo — dry-aged ribeye', color: 'linear-gradient(135deg, #9B2335 0%, #6B1528 100%)' },
  { src: null, alt: 'Tiramisù della Casa', color: 'linear-gradient(135deg, #3a2218 0%, #BFA882 100%)' },
];

export default function Gallery() {
  // The 6-slot grid derived from placements (what's displayed on the page)
  const [gridItems, setGridItems] = useState(FALLBACK_ITEMS);
  // The full published library — used as the lightbox collection
  const [allItems, setAllItems] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  // Fetch the 6 placed photos for the visual grid
  useEffect(() => {
    apiGet('/api/gallery/placements?section=homepage_taste')
      .then((data) => {
        if (!Array.isArray(data) || data.length === 0) return;
        const slots = FALLBACK_ITEMS.map((fallback, i) => {
          const placement = data.find((p) => p.display_order === i + 1);
          if (!placement?.gallery_item) return fallback;
          return {
            src: resolveApiUrl(placement.gallery_item.image_url),
            alt: placement.gallery_item.alt,
            color: fallback.color,
            // Keep the gallery item ID so we can find its position in the full library
            galleryItemId: placement.gallery_item.id,
          };
        });
        setGridItems(slots);
      })
      .catch(() => {});
  }, []);

  // Fetch all published photos for the lightbox scroll-through
  useEffect(() => {
    apiGet('/api/gallery?per_page=100')
      .then((data) => {
        const items = data?.items;
        if (Array.isArray(items) && items.length > 0) {
          setAllItems(items);
        }
      })
      .catch(() => {});
  }, []);

  // When a grid photo is clicked, open the lightbox at the matching position
  // in the full library. Falls back to grid index if the item isn't in the library yet.
  const handlePhotoClick = (gridIdx) => {
    const clicked = gridItems[gridIdx];
    if (allItems.length > 0 && clicked?.galleryItemId != null) {
      const fullIdx = allItems.findIndex((item) => item.id === clicked.galleryItemId);
      setLightboxIndex(fullIdx >= 0 ? fullIdx : 0);
    } else {
      // Library not loaded yet or fallback placeholder — open at grid position
      setLightboxIndex(gridIdx);
    }
  };

  // The lightbox uses either the full library (if loaded) or the 6 grid items as fallback.
  // Fallback items are shaped to match what Lightbox expects: { image_url, alt }
  const lightboxImages =
    allItems.length > 0
      ? allItems
      : gridItems
          .filter((i) => i.src)
          .map((i) => ({ image_url: i.src, alt: i.alt }));

  return (
    <section id="gallery" className="bg-ts-linen py-20">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6">
        {/* Header row */}
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

        {/* Photo grid */}
        <FadeIn
          className="grid grid-cols-2 gap-4 md:grid-cols-3"
          childClassName="aspect-square"
          delayStep={0.08}
        >
          {gridItems.map((image, idx) => (
            <button
              key={image.alt}
              type="button"
              onClick={() => handlePhotoClick(idx)}
              className="group relative h-full w-full cursor-pointer overflow-hidden rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ts-crimson focus-visible:ring-offset-2"
              aria-label={`View photo: ${image.alt}`}
            >
              {image.src ? (
                <ProgressiveImage
                  src={thumbUrl(image.src, 800)}
                  alt={image.alt}
                  className="h-full w-full"
                  imageClassName="object-cover transition duration-500 group-hover:scale-105"
                />
              ) : (
                <div
                  className="h-full w-full transition duration-500 group-hover:scale-105"
                  style={{ background: image.color }}
                  aria-hidden="true"
                />
              )}
              {/* Hover overlay */}
              <div className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-transparent to-transparent p-4 opacity-0 transition duration-300 group-hover:opacity-100">
                <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/90 line-clamp-1">
                  {image.alt}
                </span>
              </div>
              {/* Expand icon hint */}
              <div className="pointer-events-none absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/30 opacity-0 backdrop-blur-sm transition duration-300 group-hover:opacity-100">
                <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </div>
            </button>
          ))}
        </FadeIn>

        {/* Instagram CTA */}
        <div className="flex justify-center">
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-3 rounded-full border border-ts-stone bg-white px-7 py-3.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-ts-muted shadow-sm transition duration-300 hover:border-ts-crimson hover:text-ts-crimson hover:shadow-md"
          >
            {/* Instagram icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 transition-colors duration-300 group-hover:text-ts-crimson"
              aria-hidden="true"
            >
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1.25" fill="currentColor" stroke="none" />
            </svg>
            See more on Instagram
          </a>
        </div>
      </div>

      {/* Lightbox — scrolls through the full published library */}
      <Lightbox
        open={lightboxIndex !== null}
        images={lightboxImages}
        startIndex={lightboxIndex ?? 0}
        onClose={() => setLightboxIndex(null)}
        instagramUrl={INSTAGRAM_URL}
      />
    </section>
  );
}
