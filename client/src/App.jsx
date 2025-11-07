import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import ScrollRestoration from './components/ScrollRestoration.jsx';
import Landing from './pages/Landing.jsx';
import AuthPage from './pages/AuthPage.jsx';
import UserDashboard from './pages/UserDashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import ShareYourIdea from './pages/ShareYourIdea.jsx';
import BookingConfirmation from './pages/BookingConfirmation.jsx';
import BlogLayout from './pages/blog/BlogLayout.jsx';
import BlogIndex from './pages/blog/BlogIndex.jsx';
import TattooAftercare from './pages/blog/TattooAftercare.jsx';
import TattooFaq from './pages/blog/TattooFaq.jsx';

const STORAGE_KEY = 'theme';
const THEMES = {
  light: 'light',
  dark: 'dark'
};

export default function App() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') {
      return THEMES.light;
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === THEMES.dark || stored === THEMES.light) {
      return stored;
    }
    const prefersDark =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? THEMES.dark : THEMES.light;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === THEMES.dark);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      // Local storage may be unavailable (e.g. private mode); ignore persistence errors.
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => (current === THEMES.dark ? THEMES.light : THEMES.dark));
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 transition-colors duration-300 dark:bg-black dark:text-gray-100">
      <div id="top" className="sr-only" tabIndex="-1" aria-label="Top of page">
        Top
      </div>
      <Header theme={theme} onToggleTheme={toggleTheme} />
      <ScrollRestoration />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/share-your-idea" element={<ShareYourIdea />} />
        <Route path="/booking/confirmation" element={<BookingConfirmation />} />
        <Route path="/blog" element={<BlogLayout />}>
          <Route index element={<BlogIndex />} />
          <Route path="aftercare" element={<TattooAftercare />} />
          <Route path="faq" element={<TattooFaq />} />
        </Route>
        <Route path="/dashboard/user" element={<UserDashboard />} />
        <Route path="/dashboard/admin/*" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </div>
  );
}
