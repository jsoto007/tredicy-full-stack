import FadeIn from '../components/FadeIn.jsx';
import Button from '../components/Button.jsx';
import { prefersReducedMotion } from '../lib/a11y.js';

export default function Hero() {
  const allowMotion = !prefersReducedMotion();

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
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-gray-500 dark:text-gray-400">Minimal craft</p>
          <h1 className="text-4xl font-semibold uppercase tracking-[0.2em] sm:text-5xl">
            Where black ink meets minimal form
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Precision-driven blackwork, fine line detailing, and bold color stories under one roof. Tailored for the
            collectors who crave clarity and quiet confidence.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Button as="a" href="#work">
              View Work
            </Button>
            <Button as="a" href="#booking" variant="secondary">
              Book Consultation
            </Button>
          </div>
        </div>
        <div className="max-w-sm self-center rounded-2xl border border-gray-200 bg-white/10 p-6 text-sm text-gray-600 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-300">
          <p className="uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Studio Hours</p>
          <p className="mt-3 font-semibold uppercase tracking-[0.2em] text-gray-900 dark:text-gray-100">Wed - Sun | 11-7</p>
          <p className="mt-4 leading-relaxed">
            Private sessions by appointment only. Each design is drafted in collaborative workshops to honor your story
            while staying true to our monochrome aesthetic.
          </p>
        </div>
      </FadeIn>
    </section>
  );
}
