import { useEffect, useState } from 'react';
import FadeIn from '../components/FadeIn.jsx';
import { apiGet } from '../lib/api.js';
import Accolades from '../sections/Accolades.jsx';

export default function SpecialsPage() {
  const [specials, setSpecials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet('/api/specials')
      .then(setSpecials)
      .catch((e) => setError(e.message || 'Failed to load specials.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      {/* Page header */}
      <div className="bg-ts-charcoal py-20 text-center">
        <FadeIn immediate className="mx-auto max-w-2xl space-y-4 px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.5em] text-ts-gold">
            Tredici Social · Bronxville, NY
          </p>
          <h1 className="font-heading text-5xl font-medium text-white sm:text-6xl">
            Specials of the Day
          </h1>
          <p className="text-lg leading-relaxed text-ts-light-text/70">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </FadeIn>
      </div>

      <main className="bg-ts-cream">
        <div className="mx-auto max-w-2xl px-6 py-16 sm:px-8">
          {loading && (
            <p className="py-12 text-center text-sm text-ts-muted">Loading specials…</p>
          )}

          {error && (
            <p className="py-12 text-center text-sm text-ts-muted">{error}</p>
          )}

          {!loading && !error && specials.length === 0 && (
            <p className="py-12 text-center text-sm text-ts-muted">
              No specials today — check back soon!
            </p>
          )}

          {!loading && specials.length > 0 && (
            <FadeIn className="space-y-16" delayStep={0.14}>
              {specials.map((section) => (
                <div key={section.id}>
                  {/* Course heading */}
                  <div className="mb-8 flex items-center gap-5">
                    <h2 className="font-heading text-3xl font-medium tracking-wide text-ts-charcoal sm:text-4xl">
                      {section.course}
                    </h2>
                    <div className="h-px flex-1 bg-ts-crimson/30" aria-hidden="true" />
                  </div>

                  {/* Dishes */}
                  <div className="space-y-8">
                    {(section.items || []).map((item) => (
                      <div key={item.id} className="space-y-2">
                        <div className="flex items-baseline justify-between gap-4">
                          <p className="font-heading text-2xl font-semibold text-ts-charcoal sm:text-3xl">
                            {item.name}
                          </p>
                          {item.price != null && (
                            <span className="shrink-0 font-heading text-lg font-medium text-ts-charcoal">
                              ${Number(item.price).toFixed(2)}
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-lg leading-relaxed text-ts-muted sm:text-xl">
                            {item.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </FadeIn>
          )}
        </div>
      </main>

      <Accolades />
    </>
  );
}
