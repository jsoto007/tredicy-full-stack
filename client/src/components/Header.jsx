import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import Button from './Button.jsx';
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
  const { isSpanish } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuPanelRef = useRef(null);
  const toggleButtonRef = useRef(null);
  const navigate = useNavigate();

  const navItems = useMemo(() => {
    const labels = isSpanish
      ? {
          gallery: 'Galeria',
          menu: 'Servicios',
          about: 'Sobre Mi',
          contact: 'Contacto',
          dashboard: 'Panel',
          appointments: 'Citas',
          profile: 'Perfil',
          settings: 'Ajustes',
          calendar: 'Calendario',
        }
      : {
          gallery: 'Gallery',
          menu: 'Menu',
          about: 'About',
          contact: 'Contact',
          dashboard: 'Dashboard',
          appointments: 'Appointments',
          profile: 'Profile',
          settings: 'Settings',
          calendar: 'Calendar',
        };

    if (isAdmin) {
      return [
        { label: labels.settings, to: '/dashboard/admin/settings', type: 'link' },
        { label: labels.calendar, to: '/dashboard/admin/calendar', type: 'link' },
        { label: labels.gallery, to: '/dashboard/admin/gallery', type: 'link' },
      ];
    }
    if (isUser) {
      return [
        { label: labels.dashboard, to: '/portal/dashboard', type: 'link', end: true },
        { label: labels.appointments, to: '/portal/appointments', type: 'link' },
        { label: labels.profile, to: '/portal/profile', type: 'link' },
      ];
    }
    return [
      { label: labels.gallery, to: '/#work', type: 'link' },
      { label: labels.menu, to: '/#services', type: 'link' },
      { label: labels.about, to: '/#about', type: 'link' },
      { label: labels.contact, to: '/#contact', type: 'link' },
    ];
  }, [isAdmin, isSpanish, isUser]);

  const copy = isSpanish
    ? {
        bookNow: 'Reservar',
        signOut: 'Salir',
        bookAppointment: 'Reservar cita',
        closeMenu: 'Cerrar menu',
        openMenu: 'Abrir menu',
      }
      : {
        bookNow: 'Book Now',
        signOut: 'Sign Out',
        bookAppointment: 'Book appointment',
        closeMenu: 'Close menu',
        openMenu: 'Open menu',
      };

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
              {copy.signOut}
            </Button>
          ) : null}

          {shouldShowConsult ? (
            <Button
              type="button"
              variant="light"
              onClick={handleConsultNavigate}
              className="hidden md:inline-flex"
            >
              {copy.bookNow}
            </Button>
          ) : null}

          {shouldShowConsult ? (
            <button
              type="button"
              onClick={handleConsultNavigate}
              className={iconButtonClass}
              aria-label={copy.bookAppointment}
            >
              <IconCalendar className="h-5 w-5" />
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleToggleMenu}
            className={iconButtonClass}
            aria-label={menuOpen ? copy.closeMenu : copy.openMenu}
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
                {copy.bookNow}
              </button>
            ) : null}
          </nav>
          {isAuthenticated ? (
            <div className="mt-4">
              <Button type="button" variant="light" onClick={handleSignOut}>
                {copy.signOut}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
