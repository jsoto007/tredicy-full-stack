import { useNavigate } from 'react-router-dom';
import FadeIn from '../components/FadeIn.jsx';
import Button from '../components/Button.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import melodiShowingNails from '../assets/melodi/melodiShowingNails.JPG';
import greenNails from '../assets/melodi/greenNails.jpg';
import whiteNails from '../assets/melodi/whiteNails.jpg';
import nailsWhiteBg from '../assets/melodi/nailsWhiteBg.jpg';
import russianManicure2 from '../assets/melodi/russianManicure2.jpg';

// Desktop: 3-column staggered layout — 5 images matching melodinails.com
const COL_OFFSETS = ['lg:pt-36', 'lg:pt-12', 'lg:pt-0'];
const HERO_COLS = [
  [
    { src: russianManicure2, alt: 'Refined Russian manicure close-up' },
    { src: nailsWhiteBg, alt: 'Neutral nail set on a clean background' },
  ],
  [
    { src: whiteNails, alt: 'Classic white nail set' },
    { src: greenNails, alt: 'Green manicure detail' },
  ],
  [
    
    { src: melodiShowingNails, alt: 'Melodi showing a completed nail set' },
  ],
];

// Mobile: 2-col with 5 images and slight offset on alternating items
const MOBILE_IMAGES = [
  { src: melodiShowingNails, alt: 'Melodi showing a completed nail set', offset: false },
  { src: whiteNails, alt: 'Classic white nail set', offset: true },
  { src: russianManicure2, alt: 'Refined Russian manicure close-up', offset: false },
  { src: greenNails, alt: 'Green manicure detail', offset: false },
  { src: nailsWhiteBg, alt: 'Neutral nail set on a clean background', offset: true },
];

export default function Hero() {
  const navigate = useNavigate();
  const { isSpanish } = useLanguage();
  const copy = isSpanish
    ? {
        eyebrow: 'Salon de unas en Bronx, Nueva York',
        address: '1205 College Ave, Bronx, NY 10456',
        description:
          'Hola, soy Melodi Mejia. Bienvenida a un salon de unas en el Bronx enfocado en preparacion saludable, estructura limpia y acabados duraderos. Reserva tu manicure, pedicure, set de acrilico o nail art en linea en minutos.',
        primaryCta: 'Reserva Ahora',
        secondaryCta: 'Ver Servicios',
      }
    : {
        eyebrow: 'Nail salon in Bronx, New York',
        address: '1205 College Ave, Bronx, NY 10456',
        description:
          'Hi, I am Melodi Mejia. Welcome to a Bronx nail salon focused on healthy prep, clean structure, and long-lasting finishes. Book your manicure, pedicure, acrylic set, or custom nail art online in minutes.',
        primaryCta: 'Book Now',
        secondaryCta: 'View Menu',
      };

  return (
    <section id="hero" className="relative isolate overflow-hidden bg-[#ECE7E2] py-16 text-[#23301d] sm:py-24">
      <svg
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[64rem] w-full stroke-gray-200 [mask-image:radial-gradient(32rem_32rem_at_center,white,transparent)]"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="melodi-hero-grid"
            width={200}
            height={200}
            x="50%"
            y={-1}
            patternUnits="userSpaceOnUse"
          >
            <path d="M.5 200V.5H200" fill="none" />
          </pattern>
        </defs>
        <svg x="50%" y={-1} className="overflow-visible fill-gray-50">
          <path
            d="M-200 0h201v201h-201Z M600 0h201v201h-201Z M-400 600h201v201h-201Z M200 800h201v201h-201Z"
            strokeWidth={0}
          />
        </svg>
        <rect width="100%" height="100%" strokeWidth={0} fill="url(#melodi-hero-grid)" />
      </svg>
      <div
        className="pointer-events-none absolute left-1/2 right-0 top-0 -z-10 -ml-24 transform-gpu overflow-hidden blur-3xl lg:ml-24 xl:ml-48"
        aria-hidden="true"
      >
        <div
          className="aspect-[801/1036] w-[50.0625rem] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30"
          style={{
            clipPath:
              'polygon(63.1% 29.5%, 100% 17.1%, 76.6% 3%, 48.4% 0%, 44.6% 4.7%, 54.5% 25.3%, 59.8% 49%, 55.2% 57.8%, 44.4% 57.2%, 27.8% 47.9%, 35.1% 81.5%, 0% 97.7%, 39.2% 100%, 35.2% 81.4%, 97.2% 52.8%, 63.1% 29.5%)',
          }}
        />
      </div>

      <FadeIn
        immediate
        delayStep={0.18}
        className="relative mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1fr_1.2fr] lg:items-start"
      >
        {/* Left: text + CTA */}
        <div className="max-w-xl space-y-7 lg:pt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[#6f7863]">{copy.eyebrow}</p>
          <h1 className="text-5xl leading-none text-[#2A3923] sm:text-6xl">Melodi Nails</h1>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#6f7863]">
            {copy.address}
          </p>
          <p className="max-w-lg text-base leading-8 text-[#5e6755]">{copy.description}</p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Button type="button" onClick={() => navigate('/appointments/new')}>
              {copy.primaryCta}
            </Button>
            <Button as="a" href="#services" variant="secondary">
              {copy.secondaryCta}
            </Button>
          </div>
        </div>

        {/* Desktop: 3-column staggered image grid (lg+) */}
        <div className="hidden gap-4 lg:grid lg:grid-cols-3 lg:items-start">
          {HERO_COLS.map((col, colIdx) => (
            <div key={colIdx} className={`flex flex-col gap-4 ${COL_OFFSETS[colIdx]}`}>
              {col.map((img) => (
                <div
                  key={img.alt}
                  className="overflow-hidden rounded-[2rem] border border-white/60 shadow-[0_22px_50px_rgba(42,57,35,0.13)]"
                >
                  <img src={img.src} alt={img.alt} loading="lazy" className="w-full object-cover" />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Mobile: 2-column grid with staggered offset (hidden on lg) */}
        <div className="grid grid-cols-2 gap-4 lg:hidden">
          {MOBILE_IMAGES.map((img) => (
            <div
              key={img.alt}
              className={`overflow-hidden rounded-[2rem] border border-white/60 shadow-[0_22px_50px_rgba(42,57,35,0.13)] ${img.offset ? 'mt-10' : ''}`}
            >
              <img src={img.src} alt={img.alt} loading="lazy" className="w-full object-cover" />
            </div>
          ))}
        </div>
      </FadeIn>
    </section>
  );
}
