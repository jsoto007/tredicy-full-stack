import { useNavigate } from 'react-router-dom';
import FadeIn from '../components/FadeIn.jsx';
import Button from '../components/Button.jsx';
import { prefersReducedMotion } from '../lib/a11y.js';

export default function Hero() {
  const allowMotion = !prefersReducedMotion();
  const navigate = useNavigate();

  const handleBookConsult = () => {
    navigate('/share-your-idea');
  };

  return (
    <section
      id="hero"
      className="relative overflow-hidden bg-gray-50 py-24 text-gray-900 transition-colors dark:bg-black dark:text-gray-100"
    >
      <div
        className={`pointer-events-none absolute inset-0 -z-10 opacity-80 ${
          allowMotion ? 'motion-safe:animate-pulse-soft' : ''
        }`}
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(17,17,17,0.65),_rgba(0,0,0,0.9))]" />
      </div>
      <FadeIn
        immediate
        delayStep={0.18}
        className="mx-auto flex max-w-6xl flex-col gap-12 px-6 text-left md:flex-row md:items-center md:justify-between"
      >
        <div className="max-w-2xl space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-gray-500 dark:text-gray-400">Private tattoo studio, Brooklyn, NY</p>
          <h1 className="text-4xl font-semibold uppercase tracking-[0.2em] sm:text-5xl">
          CUSTOM FINE LINE & MICROREALISM TATTOOS IN BROOKLYN
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Precision first. Each piece begins with a collaborative sketch session, then a surgical focus on form,
            balance, and the way your story moves across skin. BlackworkNYC delivers bespoke tattoos for New York
            collectors who crave calm, considered craft.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Button as="a" href="#work">
              View Work
            </Button>
            <Button type="button" onClick={handleBookConsult} variant="secondary">
              Book Consultation
            </Button>
          </div>
        </div>
        <div className="relative max-w-sm self-center rounded-3xl border border-gray-200/70 bg-white/80 p-6 text-sm text-gray-700 shadow-lg shadow-black/5 backdrop-blur-md dark:border-gray-800/80 dark:bg-gray-900/60 dark:text-gray-200">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/90 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            <span>Appointment Only</span>
          </div>
          
          <p className="text-[0.8rem] text-gray-600 dark:text-gray-400">Great location in the heart of</p>
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-gray-500 dark:text-gray-400">Greenpoint · Brooklyn</p>

          <p className="mt-4 leading-relaxed text-[0.9rem] text-gray-700 dark:text-gray-300">
            Each design is drafted in collaborative workshops to honor your story while staying true to our monochrome aesthetic.
          </p>
        </div>
      </FadeIn>
    </section>
  );
}
