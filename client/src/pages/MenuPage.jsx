import { useEffect, useState } from 'react';
import FadeIn from '../components/FadeIn.jsx';
import { apiGet } from '../lib/api.js';
import Accolades from '../sections/Accolades.jsx';

const TAG_LABELS = {
  v: { label: 'Vegetarian', short: 'V', bg: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  gf: { label: 'Gluten-Free', short: 'GF', bg: 'bg-amber-50 text-amber-700 ring-amber-200' },
  signature: { label: 'House Signature', short: 'S', bg: 'bg-ts-crimson/10 text-ts-crimson ring-ts-crimson/20' },
};

function Tag({ tagKey }) {
  const tag = TAG_LABELS[tagKey];
  if (!tag) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.3em] ring-1 ${tag.bg}`}
      title={tag.label}
    >
      {tag.short}
    </span>
  );
}

function MenuItem({ item }) {
  return (
    <div className="group border-b border-ts-stone py-5 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-lg font-medium text-ts-charcoal">{item.name}</h3>
            {(item.tags || []).map((t) => <Tag key={t} tagKey={t} />)}
          </div>
          {item.description && (
            <p className="text-sm leading-relaxed text-ts-muted">{item.description}</p>
          )}
        </div>
        {item.price != null && (
          <span className="shrink-0 font-heading text-base font-medium text-ts-charcoal">
            ${Number(item.price).toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}

function MenuSection({ section }) {
  return (
    <div id={section.name.toLowerCase().replace(/\s+/g, '-')} className="scroll-mt-20">
      <div className="mb-6 flex items-center gap-4">
        <h2 className="font-heading text-2xl font-medium text-ts-charcoal sm:text-3xl">
          {section.name}
        </h2>
        <div className="h-px flex-1 bg-ts-stone" aria-hidden="true" />
      </div>
      {section.description && (
        <p className="mb-4 text-sm text-ts-muted">{section.description}</p>
      )}
      <div>
        {(section.items || []).map((item) => (
          <MenuItem key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

export default function MenuPage() {
  const [menuData, setMenuData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet('/api/menu')
      .then(setMenuData)
      .catch((e) => setError(e.message || 'Failed to load menu.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      {/* Page header */}
      <div className="bg-ts-charcoal py-16 text-center">
        <FadeIn immediate className="mx-auto max-w-2xl space-y-3 px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.5em] text-ts-gold">
            Tredici Social
          </p>
          <h1 className="font-heading text-5xl font-medium text-white">Our Menu</h1>
          <p className="text-sm text-ts-light-text/70">
            Seasonal ingredients, Italian craft. Menu changes periodically — ask your server about today&apos;s specials.
          </p>
        </FadeIn>
      </div>

      <main className="mx-auto max-w-3xl px-6 py-16">
        {loading && (
          <p className="py-12 text-center text-sm text-ts-muted">Loading menu…</p>
        )}

        {error && (
          <p className="py-12 text-center text-sm text-ts-muted">{error}</p>
        )}

        {!loading && !error && menuData.length === 0 && (
          <p className="py-12 text-center text-sm text-ts-muted">Menu coming soon.</p>
        )}

        {!loading && menuData.length > 0 && (
          <>
            {/* Category jump links */}
            <nav className="mb-12 flex flex-wrap gap-2" aria-label="Jump to menu section">
              {menuData.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.name.toLowerCase().replace(/\s+/g, '-')}`}
                  className="rounded-full border border-ts-stone px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-ts-muted transition hover:border-ts-crimson hover:text-ts-crimson"
                >
                  {section.name}
                </a>
              ))}
            </nav>

            {/* Menu sections */}
            <FadeIn className="space-y-14" delayStep={0.1}>
              {menuData.map((section) => (
                <MenuSection key={section.id} section={section} />
              ))}
            </FadeIn>

            {/* Legend */}
            <div className="mt-14 border-t border-ts-stone pt-8">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.4em] text-ts-muted">
                Key
              </p>
              <div className="flex flex-wrap gap-3">
                {Object.entries(TAG_LABELS).map(([key, tag]) => (
                  <span key={key} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold ring-1 ${tag.bg}`}>
                    <span className="min-w-5 text-center">{tag.short}</span>
                    <span>{tag.label}</span>
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Reservation CTA */}
        <div className="mt-12 rounded-2xl bg-ts-charcoal p-8 text-center">
          <p className="font-heading text-2xl font-medium text-white">Ready to dine?</p>
          <p className="mt-2 text-sm text-ts-light-text/70">
            Reserve your table on OpenTable — we recommend booking ahead for weekends.
          </p>
          <a
            href="https://www.opentable.com/r/tredici-social-bronxville"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-ts-scarlet px-8 py-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-white shadow-crimson transition hover:bg-ts-crimson"
          >
            Reserve on OpenTable
          </a>
        </div>
      </main>

      <Accolades />
    </>
  );
}
