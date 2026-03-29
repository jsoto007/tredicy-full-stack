import FadeIn from '../components/FadeIn.jsx';
import Card from '../components/Card.jsx';
import SectionTitle from '../components/SectionTitle.jsx';

const CONTACT_POINTS = [
  {
    id: 'location',
    heading: 'Location',
    value: '13 Pondfield Rd, Bronxville, NY 10708',
    body: 'Located in the heart of Bronxville village. Metered street parking available; Metro-North accessible (Bronxville station, 5 min walk).',
    href: 'https://maps.google.com/?q=13+Pondfield+Rd+Bronxville+NY+10708',
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

        {/* Embedded map placeholder — replace iframe src with your real embed */}
        <div className="overflow-hidden rounded-2xl border border-ts-stone bg-ts-linen shadow-card">
          <iframe
            title="Tredici Social on Google Maps"
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3011.563894032452!2d-73.83443!3d40.93825!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c2f3b4af1b7c29%3A0x0!2sBronxville%2C+NY+10708!5e0!3m2!1sen!2sus!4v1700000000000"
            width="100%"
            height="360"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            aria-label="Map showing Tredici Social location in Bronxville, NY"
          />
        </div>
      </FadeIn>
    </section>
  );
}
