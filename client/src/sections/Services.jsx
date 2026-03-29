// MenuHighlights — featured dishes on the landing page.
// This replaces the nail salon "Services" section.
import { Link } from 'react-router-dom';
import FadeIn from '../components/FadeIn.jsx';
import SectionTitle from '../components/SectionTitle.jsx';

const FEATURED = [
  {
    id: 'f1',
    category: 'Antipasto',
    name: 'Polpo alla Griglia',
    description: 'Grilled Spanish octopus, Calabrian chili, white bean purée, pickled celery, smoked paprika oil',
    accent: '#6B1528',
  },
  {
    id: 'f2',
    category: 'Pasta',
    name: 'Tagliatelle al Ragù',
    description: 'Fresh egg tagliatelle, slow-braised Wagyu beef and pork ragù, Parmigiano-Reggiano',
    accent: '#9B2335',
    badge: 'House Signature',
  },
  {
    id: 'f3',
    category: 'Secondi',
    name: 'Costata di Manzo',
    description: '28-day dry-aged bone-in ribeye, rosemary-garlic compound butter, natural jus',
    accent: '#BFA882',
    badge: 'For the Table',
  },
  {
    id: 'f4',
    category: 'Dolci',
    name: 'Tiramisù della Casa',
    description: 'Classic house tiramisù, espresso-soaked ladyfingers, mascarpone, Valrhona cocoa',
    accent: '#2E1F18',
    badge: 'House Signature',
  },
];

export default function MenuHighlights() {
  return (
    <section id="menu-highlights" className="bg-ts-charcoal py-20 text-white">
      <FadeIn className="mx-auto flex max-w-7xl flex-col gap-12 px-6" delayStep={0.12}>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionTitle
            eyebrow="From Our Kitchen"
            title="Dishes worth the drive"
            description="A few of the plates that define Tredici Social — rooted in Italian craft, made with obsessive care."
            light
          />
          <Link
            to="/menu"
            className="shrink-0 inline-flex items-center gap-2 rounded-full border border-ts-gold/50 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-ts-gold transition hover:border-ts-gold hover:bg-ts-gold/10"
          >
            Full Menu
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        <FadeIn
          className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4"
          childClassName="h-full"
          delayStep={0.1}
        >
          {FEATURED.map((dish) => (
            <div
              key={dish.id}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#2E1F18] transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-card-hover"
            >
              {/* Color accent bar */}
              <div
                className="h-1 w-full"
                style={{ background: dish.accent }}
                aria-hidden="true"
              />
              <div className="flex flex-1 flex-col gap-3 p-6">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.4em] text-ts-gold">
                    {dish.category}
                  </span>
                  {dish.badge && (
                    <span className="rounded-full bg-ts-crimson/20 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.3em] text-ts-gold">
                      {dish.badge}
                    </span>
                  )}
                </div>
                <h3 className="font-heading text-xl font-medium text-white">{dish.name}</h3>
                <p className="flex-1 text-sm leading-relaxed text-ts-light-text/65">{dish.description}</p>
              </div>
            </div>
          ))}
        </FadeIn>
      </FadeIn>
    </section>
  );
}
