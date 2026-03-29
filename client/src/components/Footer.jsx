import { Link } from 'react-router-dom';

const year = new Date().getFullYear();

const HOURS = [
  { days: 'Tuesday – Thursday', time: '5:00 pm – 10:00 pm' },
  { days: 'Friday – Saturday', time: '5:00 pm – 11:00 pm' },
  { days: 'Sunday', time: '4:00 pm – 9:00 pm' },
  { days: 'Monday', time: 'Closed' },
];

export default function Footer() {
  return (
    <footer className="bg-ts-charcoal text-ts-light-text">
      {/* Top band */}
      <div className="border-b border-white/10">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-[1.4fr_1fr_1fr] md:gap-8">
          {/* Brand column */}
          <div className="space-y-5">
            <div>
              <p className="font-heading text-2xl font-medium tracking-[0.1em] text-white">Tredici Social</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.45em] text-ts-gold">
                Contemporary Italian · Bronxville, NY
              </p>
            </div>
            <address className="space-y-1 text-sm not-italic leading-relaxed text-ts-light-text/70">
              <p>104 Kraft Ave</p>
              <p>Bronxville, NY 10708</p>
            </address>
            <div className="space-y-1 text-sm text-ts-light-text/70">
              <a
                href="tel:+19145550013"
                className="block transition hover:text-white"
                aria-label="Call Tredici Social"
              >
                (914) 555-0013
              </a>
              <a
                href="mailto:hello@tredicisocial.com"
                className="block transition hover:text-white"
                aria-label="Email Tredici Social"
              >
                hello@tredicisocial.com
              </a>
            </div>
            <a
              href="https://sotodev.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] text-ts-muted underline-offset-4 transition hover:text-ts-gold hover:underline"
            >
              Powered by SotoDev, LLC
            </a>
          </div>

          {/* Hours column */}
          <div className="space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.45em] text-ts-gold">Hours</p>
            <ul className="space-y-2.5 text-sm text-ts-light-text/70">
              {HOURS.map(({ days, time }) => (
                <li key={days} className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                  <span className="font-medium text-ts-light-text/90">{days}</span>
                  <span>{time}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Links column */}
          <div className="space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.45em] text-ts-gold">Explore</p>
            <nav className="flex flex-col gap-3 text-sm text-ts-light-text/70" aria-label="Footer navigation">
              <Link to="/menu" className="transition hover:text-white">
                Menu
              </Link>
              <Link to="/specials" className="transition hover:text-white">
                Specials
              </Link>
              <a
                href="https://www.opentable.com/r/tredici-social-bronxville"
                target="_blank"
                rel="noopener noreferrer"
                className="transition hover:text-white"
              >
                Reservations
              </a>
              <Link to="/private-events" className="transition hover:text-white">
                Private Events
              </Link>
              <Link to="/gallery" className="transition hover:text-white">
                Gallery
              </Link>
              <a href="#about" className="transition hover:text-white">
                About
              </a>
              <a href="#top" className="mt-2 text-ts-muted transition hover:text-ts-gold">
                Back to top ↑
              </a>
            </nav>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-5 text-[11px] text-ts-muted md:flex-row md:items-center md:justify-between">
        <span className="font-semibold uppercase tracking-[0.3em]">© {year} Tredici Social</span>
        <span>104 Kraft Ave · Bronxville, NY 10708</span>
      </div>
    </footer>
  );
}
