import { Link } from 'react-router-dom';
import melodiLogo from '../assets/melodi/LogoWithBg.png';

const year = new Date().getFullYear();

export default function Footer() {
  return (
    <footer className="border-t border-[#d8c7b4] bg-[#fffdf9]/90">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 text-sm text-[#5e6755] md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:gap-4">
          <img src={melodiLogo} alt="Melodi Nails logo" className="h-14 w-auto shadow-[0_10px_24px_rgba(42,57,35,0.12)]" />
          <span className="text-xs font-semibold uppercase tracking-[0.3em]">© {year} Melodi Nails</span>
          <a
            href="https://sotodev.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[#6f7863] underline underline-offset-4 transition hover:text-[#2a3923] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8d755a]"
          >
            Powered by SotoDev, LLC
          </a>
        </div>
        <div className="flex flex-wrap items-start gap-8 text-sm">
          <a
            href="https://www.instagram.com/_melodinails_?igsh=dWV5Y2VoOGd2dzI2&utm_source=qr"
            target="_blank"
            rel="noreferrer"
            className="uppercase tracking-[0.2em] transition hover:text-[#2a3923]"
          >
            Instagram
          </a>
          <Link to="/policies/terms" className="uppercase tracking-[0.2em] transition hover:text-[#2a3923]">
            Policies
          </Link>
          <a href="#top" className="uppercase tracking-[0.2em] transition hover:text-[#2a3923]">
            Back to top
          </a>
          <Link to="/auth" className="uppercase tracking-[0.2em] transition hover:text-[#2a3923]">
            Admin
          </Link>
        </div>
      </div>
    </footer>
  );
}
