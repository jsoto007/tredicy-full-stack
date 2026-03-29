import FadeIn from '../components/FadeIn.jsx';

// Replace HERO_IMAGE_URL with a real high-res food or interior photo.
// The dark overlay ensures text remains legible over any image.
const HERO_IMAGE_URL = null;

export default function Hero() {
  return (
    <section
      id="hero"
      className="relative isolate flex min-h-[92vh] flex-col items-center justify-center overflow-hidden bg-ts-charcoal text-center"
      style={
        HERO_IMAGE_URL
          ? { backgroundImage: `url(${HERO_IMAGE_URL})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : undefined
      }
    >
      {/* Background: gradient/texture when no photo is present */}
      {!HERO_IMAGE_URL && (
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(155,35,53,0.28) 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 80% 100%, rgba(107,21,40,0.22) 0%, transparent 55%), linear-gradient(160deg, #2E1F18 0%, #1C1410 50%, #1a0f0c 100%)',
          }}
        />
      )}

      {/* Dark overlay for image mode */}
      {HERO_IMAGE_URL && (
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-ts-charcoal/70 via-ts-charcoal/50 to-ts-charcoal/80"
          aria-hidden="true"
        />
      )}

      {/* Subtle grain texture */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.04]"
        aria-hidden="true"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'1\'/%3E%3C/svg%3E")',
        }}
      />

      <FadeIn immediate className="mx-auto max-w-4xl space-y-8 px-6 py-24">
        {/* Eyebrow */}
        <p className="text-[11px] font-semibold uppercase tracking-[0.55em] text-ts-gold">
          Contemporary Italian · Bronxville, New York
        </p>

        {/* Headline */}
        <h1 className="font-heading text-5xl font-medium leading-[1.05] tracking-[0.02em] text-white sm:text-6xl lg:text-7xl">
          Modern Italian
          <br />
          <em className="not-italic text-ts-gold">in Bronxville</em>
        </h1>

        {/* Supporting copy */}
        <p className="mx-auto max-w-xl text-base leading-relaxed text-ts-light-text/75">
          Inventive cuisine rooted in Italian tradition. A warm, social neighborhood restaurant where every dish — and every evening — is worth remembering.
        </p>

        {/* CTAs */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href="https://www.opentable.com/r/tredici-social-bronxville"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-full bg-ts-scarlet px-8 py-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-white shadow-crimson transition hover:bg-ts-crimson focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:w-auto"
          >
            Reserve on OpenTable
          </a>
          <a
            href="/menu"
            className="w-full rounded-full border border-white/40 px-8 py-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-white transition hover:border-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:w-auto"
          >
            View Menu
          </a>
        </div>
      </FadeIn>

      {/* Scroll indicator */}
      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40"
        aria-hidden="true"
      >
        <span className="text-[9px] uppercase tracking-[0.4em] text-white">Scroll</span>
        <svg className="h-4 w-4 text-white animate-bounce" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </section>
  );
}
