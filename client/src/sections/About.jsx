import { useEffect, useState } from 'react';
import FadeIn from '../components/FadeIn.jsx';
import ProgressiveImage from '../components/ProgressiveImage.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import { apiGet, resolveApiUrl } from '../lib/api.js';
import { thumbSrcSet, thumbUrl } from '../lib/image.js';

// Fallback gradient panels shown when no photo is placed in a slot.
// Ordered to match display_order 1–4 (left-col tall, left-col sq, right-col sq, right-col tall).
const FALLBACK_PANELS = [
  { label: 'The Room',  color: 'linear-gradient(160deg, #2E1F18 0%, #3a2218 100%)', aspectRatio: '3/4' },
  { label: 'The Plate', color: 'linear-gradient(160deg, #6B1528 0%, #9B2335 100%)', aspectRatio: '1/1' },
  { label: 'The Bar',   color: 'linear-gradient(160deg, #BFA882 0%, #8A6E4A 100%)', aspectRatio: '1/1' },
  { label: 'The Pasta', color: 'linear-gradient(160deg, #1C1410 0%, #2E1F18 100%)', aspectRatio: '3/4' },
];

const HIGHLIGHTS = [
  'Inventive Italian cuisine rooted in regional tradition',
  'Thoughtfully sourced ingredients, seasonal menus',
  'Warm, neighborhood atmosphere — social by design',
];

export default function About() {
  const [panels, setPanels] = useState(FALLBACK_PANELS);

  useEffect(() => {
    apiGet('/api/gallery/placements?section=our_story')
      .then((data) => {
        if (!Array.isArray(data) || data.length === 0) return;
        setPanels(
          FALLBACK_PANELS.map((fallback, i) => {
            const placement = data.find((p) => p.display_order === i + 1);
            if (!placement?.gallery_item) return fallback;
            return {
              ...fallback,
              imageUrl: resolveApiUrl(placement.gallery_item.image_url),
              label: placement.slot_label || placement.gallery_item.alt || fallback.label,
              alt: placement.gallery_item.alt || fallback.label
            };
          })
        );
      })
      .catch(() => {});
  }, []);

  // Split panels into left column (indices 0,1) and right column (indices 2,3)
  const leftPanels = panels.slice(0, 2);
  const rightPanels = panels.slice(2, 4);

  return (
    <section id="about" className="bg-ts-cream py-20">
      <FadeIn
        className="mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-2"
        delayStep={0.18}
      >
        {/* Text side */}
        <div className="space-y-8">
          <SectionTitle
            eyebrow="Our Story"
            title="Where Italian tradition meets Bronxville's table"
            description="Tredici Social was born from a simple belief: that exceptional Italian food should feel both elevated and welcoming. We draw from the deep well of regional Italian cooking — pasta made by hand, sauces built slowly, proteins chosen with care — and present it in a way that invites conversation, lingering, and returning."
          />

          <ul className="space-y-3">
            {HIGHLIGHTS.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 text-sm text-ts-dark-text"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ts-crimson/10 text-ts-crimson">
                  <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="https://www.opentable.com/r/tredici-social-bronxville"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-ts-crimson px-7 py-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-white shadow-crimson transition hover:bg-ts-garnet"
            >
              Reserve a Table
            </a>
            <a
              href="/private-events"
              className="inline-flex items-center justify-center rounded-full border border-ts-stone px-7 py-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-ts-dark-text transition hover:border-ts-crimson hover:text-ts-crimson"
            >
              Private Events
            </a>
          </div>
        </div>

        {/* Visual side — Our Story photo panels (managed via admin → Section Placements) */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-4">
            {leftPanels.map((panel) => (
              <div
                key={panel.label}
                className="relative overflow-hidden rounded-2xl"
                style={{ aspectRatio: panel.aspectRatio }}
              >
                {panel.imageUrl ? (
                  <ProgressiveImage
                    src={thumbUrl(panel.imageUrl, 600)}
                    srcSet={thumbSrcSet(panel.imageUrl, [400, 800, 1200])}
                    sizes="(max-width: 640px) 100vw, 40vw"
                    alt={panel.alt || panel.label}
                    className="h-full w-full"
                    imageClassName="object-cover"
                  />
                ) : (
                  <div
                    className="h-full w-full"
                    style={{ background: panel.color }}
                    aria-hidden="true"
                  />
                )}
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/40 to-transparent p-5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.4em] text-white/70">
                    {panel.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-4 pt-8">
            {rightPanels.map((panel) => (
              <div
                key={panel.label}
                className="relative overflow-hidden rounded-2xl"
                style={{ aspectRatio: panel.aspectRatio }}
              >
                {panel.imageUrl ? (
                  <ProgressiveImage
                    src={thumbUrl(panel.imageUrl, 600)}
                    srcSet={thumbSrcSet(panel.imageUrl, [400, 800, 1200])}
                    sizes="(max-width: 640px) 100vw, 40vw"
                    alt={panel.alt || panel.label}
                    className="h-full w-full"
                    imageClassName="object-cover"
                  />
                ) : (
                  <div
                    className="h-full w-full"
                    style={{ background: panel.color }}
                    aria-hidden="true"
                  />
                )}
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/40 to-transparent p-5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.4em] text-white/70">
                    {panel.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </FadeIn>
    </section>
  );
}
