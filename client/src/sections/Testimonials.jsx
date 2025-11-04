import { useEffect, useMemo, useState } from 'react';
import FadeIn from '../components/FadeIn.jsx';
import Card from '../components/Card.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import Stars from '../components/Stars.jsx';
import localTestimonials from '../data/testimonials.json';
import { apiGet } from '../lib/api.js';

export default function Testimonials() {
  const [entries, setEntries] = useState(localTestimonials);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const data = await apiGet('/api/testimonials', { signal: controller.signal });
        if (Array.isArray(data) && data.length) {
          setEntries(data);
          setStatus(null);
        } else {
          setEntries(localTestimonials);
          setStatus('Studio notes - real words, demo data.');
        }
      } catch (error) {
        setEntries(localTestimonials);
        setStatus('Offline mode - sharing studio notes.');
      }
    }

    load();

    return () => controller.abort();
  }, []);

  const entriesKey = useMemo(
    () => entries.map((entry) => entry.id ?? entry.email ?? entry.name ?? '').join('|') || 'testimonials',
    [entries]
  );

  return (
    <section id="testimonials" className="bg-gray-50 py-16 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6">
        <SectionTitle
          eyebrow="Testimonials"
          title="Trusted by collectors"
          description="A few words from clients who return for linework refreshers, large-scale projects, and thoughtful cover-ups."
        />
        {status ? <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">{status}</p> : null}
        <FadeIn key={entriesKey} className="grid gap-8 md:grid-cols-3" childClassName="h-full" delayStep={0.12}>
          {entries.map((entry) => (
            <Card key={entry.id} className="h-full space-y-6">
              <div className="space-y-4">
                <Stars rating={entry.rating} />
                <p className="text-sm text-gray-600 dark:text-gray-300">&ldquo;{entry.quote}&rdquo;</p>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">{entry.name}</p>
            </Card>
          ))}
        </FadeIn>
      </div>
    </section>
  );
}
