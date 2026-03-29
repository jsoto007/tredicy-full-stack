// ReservationsBand — dark CTA band encouraging table reservations via OpenTable
import FadeIn from '../components/FadeIn.jsx';

export default function ReservationsBand() {
  return (
    <section
      id="reservations"
      className="relative overflow-hidden bg-ts-charcoal py-20 text-center"
    >
      {/* Subtle crimson glow */}
      <div
        className="pointer-events-none absolute inset-0 -z-0"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 100%, rgba(155,35,53,0.20) 0%, transparent 60%)',
        }}
      />

      <FadeIn className="relative z-10 mx-auto max-w-2xl space-y-8 px-6" delayStep={0.15}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.5em] text-ts-gold">
          Reservations
        </p>

        <h2 className="font-heading text-4xl font-medium text-white sm:text-5xl">
          Reserve your table
        </h2>

        <p className="text-base leading-relaxed text-ts-light-text/70">
          We recommend reserving in advance, especially on weekends. Walk-ins are welcome subject to availability.
        </p>

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href="https://www.opentable.com/r/tredici-social-bronxville"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-full bg-ts-scarlet px-10 py-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-white shadow-crimson transition hover:bg-ts-crimson focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:w-auto"
          >
            Reserve on OpenTable
          </a>
          <a
            href="tel:+19145550013"
            className="w-full rounded-full border border-white/30 px-10 py-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-white transition hover:border-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:w-auto"
          >
            Call Us
          </a>
        </div>

        <p className="text-[11px] uppercase tracking-[0.35em] text-ts-muted">
          Tue – Thu 5–10pm &nbsp;·&nbsp; Fri – Sat 5–11pm &nbsp;·&nbsp; Sun 4–9pm
        </p>
      </FadeIn>
    </section>
  );
}
