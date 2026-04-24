import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import trediciLogo from '../assets/tredici-logo.png';

const NAV_ITEMS = [
  { label: 'Menu', to: '/menu' },
  { label: 'Specials', to: '/specials' },
  { label: 'Reservations', href: '#reservations' },
  { label: 'Private Events', to: '/private-events' },
  { label: 'Gallery', to: '/gallery' },
  { label: 'About', href: '#about' },
];

// On the home page, "Reservations" and "About" scroll to sections;
// on other pages they navigate to home first.
function NavItem({ item, onNavigate, location }) {
  const isHome = location.pathname === '/';
  const linkClass =
    'text-[#BFA882] transition-colors hover:text-white focus:outline-none focus-visible:underline text-[11px] font-semibold uppercase tracking-[0.3em]';

  if (item.href) {
    const href = isHome ? item.href : `/${item.href}`;
    return (
      <a href={href} onClick={onNavigate} className={linkClass}>
        {item.label}
      </a>
    );
  }

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `${linkClass}${isActive ? ' text-white underline underline-offset-4' : ''}`
      }
    >
      {item.label}
    </NavLink>
  );
}

const ADMIN_NAV_ITEMS = [
  { label: 'Calendar', to: '/dashboard/admin/calendar' },
  { label: 'Gallery', to: '/dashboard/admin/gallery' },
  { label: 'Menu', to: '/dashboard/admin/menu' },
  { label: 'Specials', to: '/dashboard/admin/specials' },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuPanelRef = useRef(null);
  const toggleButtonRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  // Compact header on scroll
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (e) => {
      if (
        menuPanelRef.current &&
        !menuPanelRef.current.contains(e.target) &&
        toggleButtonRef.current &&
        !toggleButtonRef.current.contains(e.target)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  const iconBtnClass =
    'inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#BFA882]/40 text-[#BFA882] transition hover:border-[#BFA882] hover:bg-[#BFA882]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#BFA882] md:hidden';

  return (
    <header
      className={`sticky top-0 z-40 border-b border-white/10 bg-ts-charcoal transition-all duration-300 ${
        scrolled ? 'py-0 shadow-[0_4px_24px_rgba(0,0,0,0.4)]' : ''
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link to="/" className="focus:outline-none focus-visible:underline" aria-label="Tredici Social — home">
          <img src={trediciLogo} alt="Tredici Social" className="h-10 w-auto" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex" aria-label="Main navigation">
          {(isAdmin ? ADMIN_NAV_ITEMS : NAV_ITEMS).map((item) => (
            <NavItem key={item.label} item={item} onNavigate={closeMenu} location={location} />
          ))}
        </nav>

        {/* Desktop CTA */}
        {isAdmin ? (
          <button
            type="button"
            onClick={handleLogout}
            className="hidden items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-ts-light-text/80 transition hover:border-white/40 hover:bg-white/10 hover:text-white md:inline-flex"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M11 11l3-3-3-3M14 8H6"/>
            </svg>
            Log out
          </button>
        ) : (
          <a
            href="https://www.opentable.com/r/tredici-social-bronxville"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded-full border border-ts-crimson bg-ts-crimson px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-ts-garnet md:inline-flex"
            aria-label="Reserve a table on OpenTable"
          >
            Reserve
          </a>
        )}

        {/* Mobile icon group */}
        <div className="flex items-center gap-2 md:hidden">
          <a
            href="https://www.opentable.com/r/tredici-social-bronxville"
            target="_blank"
            rel="noopener noreferrer"
            className={iconBtnClass.replace('md:hidden', '')}
            aria-label="Reserve a table on OpenTable"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
              <path d="M8 2.5v4M16 2.5v4M3.5 9.5h17" />
              <circle cx="12" cy="15" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </a>

          <button
            type="button"
            ref={toggleButtonRef}
            onClick={() => setMenuOpen((o) => !o)}
            className={iconBtnClass.replace('md:hidden', '')}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
          >
          {menuOpen ? (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
          </button>
        </div>{/* end mobile icon group */}
      </div>

      {/* Mobile nav panel */}
      {menuOpen && (
        <div
          id="mobile-navigation"
          ref={menuPanelRef}
          className="border-t border-white/10 bg-[#2E1F18] px-6 py-5 md:hidden"
        >
          {isAdmin && (
            <p className="mb-4 text-[9px] font-semibold uppercase tracking-[0.4em] text-ts-gold">
              Admin Portal
            </p>
          )}
          <nav className="flex flex-col gap-5" aria-label="Mobile navigation">
            {(isAdmin ? ADMIN_NAV_ITEMS : NAV_ITEMS).map((item) => (
              <NavItem key={item.label} item={item} onNavigate={closeMenu} location={location} />
            ))}
          </nav>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => { closeMenu(); handleLogout(); }}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full border border-white/20 py-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-ts-light-text/80 transition hover:bg-white/10 hover:text-white"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M11 11l3-3-3-3M14 8H6"/>
              </svg>
              Log out
            </button>
          ) : (
            <a
              href="https://www.opentable.com/r/tredici-social-bronxville"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 block w-full rounded-full bg-ts-crimson py-3 text-center text-[11px] font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-ts-garnet"
              onClick={closeMenu}
            >
              Reserve on OpenTable
            </a>
          )}
        </div>
      )}
    </header>
  );
}
