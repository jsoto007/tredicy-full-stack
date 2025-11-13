import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { ClientPortalProvider } from '../../contexts/ClientPortalContext.jsx';
import Button from '../../components/Button.jsx';
import { USER_NAV_ITEMS } from '../../data/navigation.js';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

const themeButtonClass =
  'inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 text-gray-600 transition hover:border-gray-900 hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-300 dark:hover:text-white dark:focus-visible:ring-gray-600 dark:focus-visible:ring-offset-black';

export default function ClientPortalLayout({ theme, onToggleTheme }) {
  const { isAuthenticated, status, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await logout();
    navigate('/auth', { replace: true });
  };
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const loading = status === 'loading';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-gray-900 dark:bg-black dark:text-gray-100">
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Loading portal…</p>
      </div>
    );
  }

  if (isAdmin) {
    return <Navigate to="/dashboard/admin" replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  const linkClasses = ({ isActive }) =>
    classNames(
      'rounded-full px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.3em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-gray-600 dark:focus-visible:ring-offset-black',
      isActive
        ? 'border-b-2 border-black text-black dark:border-white dark:text-white'
        : 'text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-gray-100'
    );

  const mobileNavItemClass =
    'text-gray-600 transition-colors hover:text-black focus:outline-none focus-visible:underline dark:text-gray-300 dark:hover:text-gray-100';

  const circleButtonClass =
    'inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 text-gray-600 transition hover:border-gray-900 hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-300 dark:hover:text-white dark:focus-visible:ring-gray-600 dark:focus-visible:ring-offset-black';

  const menuButtonClass = `${circleButtonClass} md:hidden`;

  return (
    <ClientPortalProvider>
      <div className="min-h-screen bg-white dark:bg-black">
        <div className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur-sm dark:border-gray-800 dark:bg-black/90">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
            <div className="flex items-center gap-6">
              <Link
                to="/"
                className="text-[0.65rem] font-semibold uppercase tracking-[0.5em] text-gray-900 transition hover:text-gray-600 dark:text-gray-100 dark:hover:text-white"
              >
                BLACKWORKNYC
              </Link>
              <nav className="hidden items-center gap-4 text-[0.65rem] uppercase tracking-[0.3em] md:flex">
                {USER_NAV_ITEMS.map((item) => (
                  <NavLink key={item.to} to={item.to} className={linkClasses} end={item.end}>
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </div>
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
              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className={menuButtonClass}
                aria-expanded={mobileMenuOpen}
                aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              >
                {mobileMenuOpen ? (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
              </button>
              <Button as={Link} to="/share-your-idea" className="hidden md:inline-flex">
                Book Consult
              </Button>
              <Button variant="secondary" onClick={handleSignOut} className="hidden md:inline-flex">
                Sign Out
              </Button>
            </div>
          </div>
          {mobileMenuOpen ? (
            <div
              id="portal-mobile-navigation"
              className="border-t border-gray-200 bg-white px-6 py-4 text-xs uppercase tracking-[0.3em] dark:border-gray-800 dark:bg-black md:hidden"
            >
              <nav className="flex flex-col gap-3">
                {USER_NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={mobileNavItemClass}
                    onClick={() => setMobileMenuOpen(false)}
                    end={item.end}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <div className="mt-4 flex flex-col gap-2">
                <Button as={Link} to="/share-your-idea" className="w-full" onClick={() => setMobileMenuOpen(false)}>
                  Book Consult
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleSignOut();
                  }}
                  className="w-full"
                >
                  Sign Out
                </Button>
              </div>
            </div>
          ) : null}
        </div>
        <main className="py-10">
          <div className="mx-auto max-w-6xl space-y-8 px-4">
            <Outlet />
          </div>
        </main>
      </div>
    </ClientPortalProvider>
  );
}
