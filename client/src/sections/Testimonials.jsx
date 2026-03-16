import { useMemo } from 'react';
import FadeIn from '../components/FadeIn.jsx';
import Card from '../components/Card.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import Stars from '../components/Stars.jsx';
import localTestimonials from '../data/testimonials.json';

export default function Testimonials() {
  const entries = localTestimonials;

  const filteredEntries = useMemo(
    () => entries.filter((entry) => Number(entry.rating) === 5),
    [entries]
  );

  const displayedEntries = useMemo(() => {
    if (filteredEntries.length <= 3) {
      return filteredEntries;
    }

    const shuffled = [...filteredEntries];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, 3);
  }, [filteredEntries]);

  const entriesKey = useMemo(
    () =>
      displayedEntries.map((entry) => entry.id ?? entry.email ?? entry.name ?? '').join('|') || 'testimonials',
    [displayedEntries]
  );

  return (
    <section id="testimonials" className="bg-[#fffaf5] py-16 text-[#23301d]">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6">
        <SectionTitle
          eyebrow="Testimonials"
          title="Clients leave glowing"
          description="A few quick notes from clients who come to Melodi Nails for beautiful finishes, organized booking, and an experience that feels calm from start to finish."
        />
        <FadeIn key={entriesKey} className="grid gap-8 md:grid-cols-3" childClassName="h-full" delayStep={0.12}>
          {displayedEntries.map((entry) => (
            <Card key={entry.id} className="h-full space-y-6 bg-[#fffdf9]">
              <div className="space-y-4">
                <Stars rating={entry.rating} />
                <p className="text-sm text-slate-900">&ldquo;{entry.quote}&rdquo;</p>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#6f7863]">{entry.name}</p>
            </Card>
          ))}
        </FadeIn>
      </div>
    </section>
  );
}
