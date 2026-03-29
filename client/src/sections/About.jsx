import FadeIn from '../components/FadeIn.jsx';
import SectionTitle from '../components/SectionTitle.jsx';

const HIGHLIGHTS = [
  'Inventive Italian cuisine rooted in regional tradition',
  'Thoughtfully sourced ingredients, seasonal menus',
  'Warm, neighborhood atmosphere — social by design',
];

export default function About() {
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

        {/* Visual side — atmospheric panels */}
        {/* Replace the gradient tiles below with real restaurant photos */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-4">
            <div
              className="overflow-hidden rounded-2xl"
              style={{
                aspectRatio: '3/4',
                background: 'linear-gradient(160deg, #2E1F18 0%, #3a2218 100%)',
              }}
              aria-label="Restaurant interior photo — replace with real image"
            >
              <div className="flex h-full items-end p-5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.4em] text-ts-gold/60">
                  The Room
                </span>
              </div>
            </div>
            <div
              className="overflow-hidden rounded-2xl"
              style={{
                aspectRatio: '1/1',
                background: 'linear-gradient(160deg, #6B1528 0%, #9B2335 100%)',
              }}
              aria-label="Food photo — replace with real image"
            >
              <div className="flex h-full items-end p-5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.4em] text-white/60">
                  The Plate
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-4 pt-8">
            <div
              className="overflow-hidden rounded-2xl"
              style={{
                aspectRatio: '1/1',
                background: 'linear-gradient(160deg, #BFA882 0%, #8A6E4A 100%)',
              }}
              aria-label="Bar photo — replace with real image"
            >
              <div className="flex h-full items-end p-5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.4em] text-ts-charcoal/60">
                  The Bar
                </span>
              </div>
            </div>
            <div
              className="overflow-hidden rounded-2xl"
              style={{
                aspectRatio: '3/4',
                background: 'linear-gradient(160deg, #1C1410 0%, #2E1F18 100%)',
              }}
              aria-label="Pasta photo — replace with real image"
            >
              <div className="flex h-full items-end p-5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.4em] text-ts-gold/60">
                  The Pasta
                </span>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>
    </section>
  );
}
