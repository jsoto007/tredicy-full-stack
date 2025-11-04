import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import Button from './Button.jsx';

const DEFAULT_NAV_ITEMS = [
  { label: 'Work', href: '#work', type: 'anchor' },
  { label: 'Services', href: '#services', type: 'anchor' },
  { label: 'About', href: '#about', type: 'anchor' },
  { label: 'Contact', href: '#contact', type: 'anchor' }
];

const USER_NAV_ITEMS = [
  { label: 'Dashboard', to: '/dashboard/user', type: 'link' },
  { label: 'Profile', to: '/dashboard/user#profile', type: 'link' },
  { label: 'Appointments', to: '/dashboard/user#appointments', type: 'link' }
];

const ADMIN_NAV_ITEMS = [
  { label: 'Settings', to: '/dashboard/admin/settings', type: 'link' },
  { label: 'Calendar', to: '/dashboard/admin/calendar', type: 'link' },
  { label: 'Gallery', to: '/dashboard/admin/gallery', type: 'link' }
];

function NavItem({ item, onNavigate }) {
  const shared =
    'text-gray-600 transition-colors hover:text-black focus:outline-none focus-visible:underline dark:text-gray-300 dark:hover:text-gray-100';

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

export default function Header({ theme, onToggleTheme }) {
  const { isAuthenticated, isAdmin, isUser, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

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

  useEffect(() => {
    setMenuOpen(false);
  }, [isAuthenticated, isAdmin, isUser]);

  const shouldShowConsult = !isAuthenticated || isUser;

  const secondaryButtonClass = 'hidden md:inline-flex';

  const themeButtonClass =
    'inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 text-gray-600 transition hover:border-gray-900 hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-300 dark:hover:text-white dark:focus-visible:ring-gray-600 dark:focus-visible:ring-offset-black';

  const menuButtonClass =
    'inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 text-gray-600 transition hover:border-gray-900 hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-300 dark:hover:text-white dark:focus-visible:ring-gray-600 dark:focus-visible:ring-offset-black md:hidden';

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur-sm dark:border-gray-800 dark:bg-black/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="text-sm font-semibold uppercase tracking-[0.5em] text-gray-900 dark:text-gray-100">
          BLACKWORKNYC
        </Link>

        <nav className="hidden items-center gap-8 text-xs font-semibold uppercase tracking-[0.3em] md:flex">
          {navItems.map((item) => (
            <NavItem key={item.label} item={item} onNavigate={closeMenu} />
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleTheme}
            className={themeButtonClass}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 3.5a1 1 0 01-.92-.6 1 1 0 011.47-1.2 9 9 0 109.15 15.08 1 1 0 011.15 1.63A11 11 0 0112 3.5z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M12 2v2m0 16v2m10-10h-2M6 12H4m15.07-6.07l-1.42 1.42M6.35 17.65l-1.42 1.42m0-12.02l1.42 1.42m11.3 11.3l1.42 1.42"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>

          {isAuthenticated ? (
            <Button type="button" variant="secondary" onClick={handleSignOut} className={secondaryButtonClass}>
              Sign Out
            </Button>
          ) : (
            <Button as={Link} to="/auth" variant="secondary" className={secondaryButtonClass}>
              Sign In
            </Button>
          )}

          {shouldShowConsult ? (
            <Button as="a" href="#booking" className="hidden md:inline-flex">
              Book Consult
            </Button>
          ) : null}

          <button
            type="button"
            onClick={handleToggleMenu}
            className={menuButtonClass}
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
        </div>
      </div>

      {menuOpen ? (
        <div
          id="mobile-navigation"
          className="border-t border-gray-200 bg-white px-6 py-4 text-xs uppercase tracking-[0.3em] dark:border-gray-800 dark:bg-black md:hidden"
        >
          <nav className="flex flex-col gap-3">
            {navItems.map((item) => (
              <NavItem key={item.label} item={item} onNavigate={closeMenu} />
            ))}
            {shouldShowConsult ? (
              <a
                href="#booking"
                onClick={closeMenu}
                className="text-gray-600 transition-colors hover:text-black focus:outline-none focus-visible:underline dark:text-gray-300 dark:hover:text-gray-100"
              >
                Book Consult
              </a>
            ) : null}
          </nav>
          <div className="mt-4 flex flex-col gap-2">
            {isAuthenticated ? (
              <Button type="button" variant="secondary" onClick={handleSignOut}>
                Sign Out
              </Button>
            ) : (
              <Button as={Link} to="/auth" variant="secondary" onClick={closeMenu}>
                Sign In
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
