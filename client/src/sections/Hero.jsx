import { useNavigate } from 'react-router-dom';
import FadeIn from '../components/FadeIn.jsx';
import Button from '../components/Button.jsx';
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

  return (
    <section id="hero" className="relative overflow-hidden bg-[#ECE7E2] py-16 text-[#23301d] sm:py-24">
      {/* Decorative gradient blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 top-0 h-80 w-80 rounded-full bg-[#c8af8f]/20 blur-3xl" />
        <div className="absolute right-0 top-0 h-[28rem] w-[28rem] rounded-full bg-[#c0a0c8]/18 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-72 w-72 rounded-full bg-[#6f7863]/15 blur-3xl" />
      </div>

      <FadeIn
        immediate
        delayStep={0.18}
        className="relative mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1fr_1.2fr] lg:items-start"
      >
        {/* Left: text + CTA */}
        <div className="max-w-xl space-y-7 lg:pt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[#6f7863]">Bronx, New York</p>
          <h1 className="text-5xl leading-none text-[#2A3923] sm:text-6xl">Melodi Nails</h1>
          <p className="max-w-lg text-base leading-8 text-[#5e6755]">
            Hola, soy Melodi Mejia. Welcome to a nail studio focused on healthy prep, clean structure, and
            beautiful finishes. Book your manicure, pedicure, or acrylic set online and choose to pay the
            deposit or the full amount with Stripe.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Button type="button" onClick={() => navigate('/share-your-idea')}>
              Reserva Ahora
            </Button>
            <Button as="a" href="#services" variant="secondary">
              View Menu
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
                  <img src={img.src} alt={img.alt} className="w-full object-cover" />
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
              <img src={img.src} alt={img.alt} className="w-full object-cover" />
            </div>
          ))}
        </div>
      </FadeIn>
    </section>
  );
}
