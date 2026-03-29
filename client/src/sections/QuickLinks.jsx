import { Link } from 'react-router-dom';
import FadeIn from '../components/FadeIn.jsx';

const TILES = [
  {
    label: 'Menu',
    description: 'Antipasti, pasta, secondi & dolci',
    to: '/menu',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 12h6M9 16h4" />
      </svg>
    ),
  },
  {
    label: 'Reservations',
    description: 'Book your table on OpenTable',
    href: 'https://www.opentable.com/r/tredici-social-bronxville',
    external: true,
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
        <path d="M8 2.5v4M16 2.5v4M3.5 9.5h17" />
        <circle cx="12" cy="15" r="2" />
      </svg>
    ),
  },
  {
    label: 'Private Events',
    description: 'Host your next occasion with us',
    to: '/private-events',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857" />
        <path d="M9 20H4v-2a3 3 0 015.356-1.857" />
        <circle cx="12" cy="7" r="4" />
        <path d="M8.21 13.89L7 14m1.21-.11A8.986 8.986 0 0112 13c1.4 0 2.73.32 3.9.89" />
      </svg>
    ),
  },
  {
    label: 'Gallery',
    description: 'Food, space, and atmosphere',
    to: '/gallery',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    ),
  },
];

export default function QuickLinks() {
  return (
    <section className="bg-ts-linen py-16">
      <FadeIn
        className="mx-auto grid max-w-7xl gap-4 px-6 sm:grid-cols-2 lg:grid-cols-4"
        childClassName="h-full"
        delayStep={0.1}
      >
        {TILES.map((tile) => {
          const inner = (
            <div className="group flex h-full flex-col gap-4 rounded-2xl border border-ts-stone bg-white p-6 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ts-linen text-ts-crimson transition group-hover:bg-ts-crimson group-hover:text-white">
                {tile.icon}
              </span>
              <div>
                <p className="font-heading text-xl font-medium text-ts-charcoal">{tile.label}</p>
                <p className="mt-1 text-sm text-ts-muted">{tile.description}</p>
              </div>
              <span className="mt-auto inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-ts-crimson transition group-hover:gap-2.5">
                {tile.external ? 'Reserve now' : 'Explore'}
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          );

          if (tile.external) {
            return (
              <a
                key={tile.label}
                href={tile.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={tile.label}
              >
                {inner}
              </a>
            );
          }

          return (
            <Link key={tile.label} to={tile.to} aria-label={tile.label}>
              {inner}
            </Link>
          );
        })}
      </FadeIn>
    </section>
  );
}
