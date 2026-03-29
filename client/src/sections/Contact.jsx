import FadeIn from '../components/FadeIn.jsx';
import Card from '../components/Card.jsx';
import SectionTitle from '../components/SectionTitle.jsx';

const CONTACT_POINTS = [
  {
    id: 'location',
    heading: 'Location',
    value: '104 Kraft Ave, Bronxville, NY 10708',
    body: 'Located in the heart of Bronxville village. Metered street parking available; Metro-North accessible (Bronxville station, 5 min walk).',
    href: 'https://maps.google.com/?q=104+Kraft+Ave+Bronxville+NY+10708',
    hrefLabel: 'Get directions in Google Maps',
    linkText: 'Get directions',
  },
  {
    id: 'hours',
    heading: 'Hours',
    value: 'Tue–Thu 5–10pm · Fri–Sat 5–11pm · Sun 4–9pm',
    body: 'Closed Mondays. We recommend reserving ahead on weekends. Private dining available by arrangement.',
  },
  {
    id: 'contact',
    heading: 'Contact',
    value: '(914) 555-0013',
    body: 'Call for same-day reservations, large party inquiries, or general questions. Email us at hello@tredicisocial.com.',
    href: 'tel:+19145550013',
    hrefLabel: 'Call Tredici Social',
    linkText: 'Call now',
  },
];

export default function Visit() {
  return (
    <section id="visit" className="bg-ts-cream py-20">
      <FadeIn className="mx-auto flex max-w-7xl flex-col gap-12 px-6" delayStep={0.14}>
        <SectionTitle
          eyebrow="Plan Your Visit"
          title="Find us in Bronxville"
          description="Tredici Social is located in the heart of the Bronxville village. Come hungry, stay late."
        />

        <FadeIn className="grid gap-6 md:grid-cols-3" childClassName="h-full" delayStep={0.1}>
          {CONTACT_POINTS.map((point) => (
            <Card key={point.id} className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.45em] text-ts-crimson">
                {point.heading}
              </p>
              <p className="font-heading text-lg font-medium text-ts-charcoal leading-snug">
                {point.value}
              </p>
              <p className="text-sm leading-relaxed text-ts-muted">{point.body}</p>
              {point.href && (
                <a
                  href={point.href}
                  target={point.id === 'location' ? '_blank' : undefined}
                  rel={point.id === 'location' ? 'noopener noreferrer' : undefined}
                  aria-label={point.hrefLabel}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-ts-crimson underline-offset-4 transition hover:underline"
                >
                  {point.linkText}
                  <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M1 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              )}
            </Card>
          ))}
        </FadeIn>

        {/* Directions card */}
        <a
          href="https://maps.google.com/?q=104+Kraft+Ave,+Bronxville,+NY+10708"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Get directions to Tredici Social — opens in your maps app"
          className="group flex items-center justify-between gap-6 rounded-2xl border border-ts-stone bg-white px-8 py-7 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-ts-crimson hover:shadow-card-hover"
        >
          <div className="flex items-center gap-5">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ts-crimson/10 text-ts-crimson transition group-hover:bg-ts-crimson group-hover:text-white">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
            </span>
            <div>
              <p className="font-heading text-xl font-medium text-ts-charcoal">Get Directions</p>
              <p className="mt-0.5 text-sm text-ts-muted">104 Kraft Ave, Bronxville, NY 10708</p>
            </div>
          </div>
          <svg className="h-5 w-5 shrink-0 text-ts-stone transition group-hover:translate-x-1 group-hover:text-ts-crimson" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </a>
      </FadeIn>
    </section>
  );
}
