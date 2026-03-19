import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import Button from './Button.jsx';
import { ADMIN_NAV_ITEMS, DEFAULT_NAV_ITEMS, USER_NAV_ITEMS } from '../data/navigation.js';
import melodiLogo from '../assets/melodi/MNLogo.png';

function IconCalendar(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
      <path d="M8 2.5v4" />
      <path d="M16 2.5v4" />
      <path d="M3.5 9.5h17" />
      <path d="M8 13.5h3" />
      <path d="M13 13.5h3" />
      <path d="M8 17.5h3" />
    </svg>
  );
}

function NavItem({ item, onNavigate }) {
  const shared =
    'text-[#c8af8f] transition-colors hover:text-[#f3e7d9] focus:outline-none focus-visible:underline';

  if (item.type === 'link') {
    return (
      <Link to={item.to} onClick={onNavigate} className={shared}>
        {item.label}
      </Link>
    );
  }

  return (
    <a href={item.href} onClick={onNavigate} className={shared}>
      {item.label}
    </a>
  );
}

export default function Header() {
  const { isAuthenticated, isAdmin, isUser, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuPanelRef = useRef(null);
  const toggleButtonRef = useRef(null);
  const navigate = useNavigate();

  const navItems = useMemo(() => {
    if (isAdmin) {
      return ADMIN_NAV_ITEMS;
    }
    if (isUser) {
      return USER_NAV_ITEMS;
    }
    return DEFAULT_NAV_ITEMS;
  }, [isAdmin, isUser]);

  const closeMenu = () => setMenuOpen(false);

  const handleToggleMenu = () => {
    setMenuOpen((open) => !open);
  };

  const handleSignOut = async () => {
    await logout();
    closeMenu();
  };

  const handleConsultNavigate = () => {
    navigate('/appointments/new');
    closeMenu();
  };

  useEffect(() => {
    setMenuOpen(false);
  }, [isAuthenticated, isAdmin, isUser]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const handlePointerDown = (event) => {
      if (
        menuPanelRef.current &&
        !menuPanelRef.current.contains(event.target) &&
        toggleButtonRef.current &&
        !toggleButtonRef.current.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [menuOpen]);

  const shouldShowConsult = !isAuthenticated || isUser;

  const iconButtonClass =
    'inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#c8af8f]/50 text-[#f3e7d9] transition hover:border-[#c8af8f] hover:bg-[#c8af8f]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c8af8f] focus-visible:ring-offset-2 focus-visible:ring-offset-[#2a3923] md:hidden';

  return (
    <header className="sticky top-0 z-40 border-b border-[#3a5030] bg-[#2a3923]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-3">
          <img
            src={melodiLogo}
            alt="Melodi Nails logo"
            loading="lazy"
            className="h-12 w-auto object-cover shadow-[0_8px_24px_rgba(0,0,0,0.3)]"
          />
          <span className="text-sm font-semibold uppercase tracking-[0.45em] text-[#f3e7d9]">
            MELODI NAILS
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-xs font-semibold uppercase tracking-[0.3em] md:flex">
          {navItems.map((item) => (
            <NavItem key={item.label} item={item} onNavigate={closeMenu} />
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <Button
              type="button"
              variant="light"
              onClick={handleSignOut}
              className="hidden md:inline-flex"
            >
              Sign Out
            </Button>
          ) : null}

          {shouldShowConsult ? (
            <Button
              type="button"
              variant="light"
              onClick={handleConsultNavigate}
              className="hidden md:inline-flex"
            >
              Book Now
            </Button>
          ) : null}

          {shouldShowConsult ? (
            <button
              type="button"
              onClick={handleConsultNavigate}
              className={iconButtonClass}
              aria-label="Book appointment"
            >
              <IconCalendar className="h-5 w-5" />
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleToggleMenu}
            className={iconButtonClass}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            ref={toggleButtonRef}
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
        </div>
      </div>

      {menuOpen ? (
        <div
          id="mobile-navigation"
          className="border-t border-[#3a5030] bg-[#243020] px-6 py-4 text-xs uppercase tracking-[0.3em] md:hidden"
          ref={menuPanelRef}
        >
          <nav className="flex flex-col gap-4">
            {navItems.map((item) => (
              <NavItem key={item.label} item={item} onNavigate={closeMenu} />
            ))}
            {shouldShowConsult ? (
              <button
                type="button"
                onClick={handleConsultNavigate}
                className="text-left text-[#c8af8f] transition-colors hover:text-[#f3e7d9] focus:outline-none focus-visible:underline"
              >
                Book Now
              </button>
            ) : null}
          </nav>
          {isAuthenticated ? (
            <div className="mt-4">
              <Button type="button" variant="light" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
