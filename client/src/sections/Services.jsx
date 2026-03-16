import { useEffect, useMemo, useState } from 'react';
import FadeIn from '../components/FadeIn.jsx';
import Card from '../components/Card.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import staticServices from '../data/services.json';
import { apiGet } from '../lib/api.js';

const PRICE_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function formatPrice(cents) {
  if (cents == null) return null;
  if (cents === 0) return 'Free';
  return PRICE_FORMATTER.format(cents / 100);
}

// Normalize a service name for loose matching (e.g. "Russian Manicure" → "russianmanicure")
function normalizeTitle(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Build a lookup map from the static JSON descriptions
const DESCRIPTION_MAP = Object.fromEntries(
  staticServices.map((s) => [normalizeTitle(s.title), s])
);

export default function Services() {
  const [sessionOptions, setSessionOptions] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    apiGet('/api/pricing/session-options', { signal: controller.signal })
      .then((data) => {
        if (Array.isArray(data)) setSessionOptions(data);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
    return () => controller.abort();
  }, []);

  // Merge API session options with static descriptions.
  // Falls back to static services (no prices) when no session options exist yet.
  const displayServices = useMemo(() => {
    if (!loaded || !sessionOptions.length) {
      return staticServices.map((s) => ({ ...s, price_cents: null }));
    }
    return sessionOptions.map((option) => {
      const key = normalizeTitle(option.name);
      const staticData = DESCRIPTION_MAP[key] || {};
      return {
        id: String(option.id),
        title: option.name || 'Service',
        tagline: staticData.tagline || '',
        description: staticData.description || '',
        duration: staticData.duration || `${option.duration_minutes} min`,
        price_cents: option.price_cents,
      };
    });
  }, [loaded, sessionOptions]);

  return (
    <section id="services" className="bg-[#ECE7E2] py-16 text-[#23301d]">
      <FadeIn className="mx-auto flex max-w-6xl flex-col gap-12 px-6" delayStep={0.16}>
        <SectionTitle
          eyebrow="Menu"
          title="Servicios que ofrecemos"
          description="Inspired by the original Melodi Nails site, this menu highlights signature appointments focused on structure, detail, and long-lasting beauty."
        />
        <FadeIn className="grid gap-8 md:grid-cols-2 xl:grid-cols-3" childClassName="h-full" delayStep={0.12}>
          {displayServices.map((service) => (
            <Card key={service.id} className="h-full space-y-4 bg-[#fffaf5]/95">
              <p className="text-xs uppercase tracking-[0.3em] text-[#6f7863]">{service.tagline}</p>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-2xl font-semibold text-slate-900">
                  {service.title}
                </h3>
                {service.price_cents != null && (
                  <span className="mt-1 shrink-0 rounded-full bg-[#2a3923] px-3 py-1 text-xs font-semibold text-[#f3e7d9]">
                    {formatPrice(service.price_cents)}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-700">{service.description}</p>
              <p className="text-xs uppercase tracking-[0.3em] text-[#8d755a]">{service.duration}</p>
            </Card>
          ))}
        </FadeIn>
      </FadeIn>
    </section>
  );
}
