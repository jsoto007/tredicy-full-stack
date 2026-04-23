import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import ScrollRestoration from './components/ScrollRestoration.jsx';
import Landing from './pages/Landing.jsx';
import MenuPage from './pages/MenuPage.jsx';
import GalleryPage from './pages/GalleryPage.jsx';
import PrivateEventsPage from './pages/PrivateEventsPage.jsx';
import SpecialsPage from './pages/SpecialsPage.jsx';

function OpenTableRedirect() {
  useEffect(() => {
    window.location.replace('https://www.opentable.com/r/tredici-social-bronxville');
  }, []);
  return null;
}

// Admin / auth routes (not linked in public nav)
import AuthPage from './pages/AuthPage.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import ActivateAccount from './pages/ActivateAccount.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import ClientPortalLayout from './pages/portal/ClientPortalLayout.jsx';
import ClientDashboardPage from './pages/portal/ClientDashboardPage.jsx';
import ClientReservationsPage from './pages/portal/ClientReservationsPage.jsx';
import ClientProfilePage from './pages/portal/ClientProfilePage.jsx';
import Policies from './pages/Policies.jsx';
import LicensePage from './pages/LicensePage.jsx';

export default function App() {
  return (
    <div className="min-h-screen bg-ts-cream text-ts-dark-text">
      <div id="top" className="sr-only" tabIndex="-1" aria-label="Top of page">
        Top
      </div>
      <Header />
      <ScrollRestoration />
      <Routes>
        {/* Public restaurant pages */}
        <Route path="/" element={<Landing />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/private-events" element={<PrivateEventsPage />} />
        <Route path="/specials" element={<SpecialsPage />} />

        {/* /reservations: bounce to OpenTable */}
        <Route path="/reservations" element={<OpenTableRedirect />} />

        {/* Admin / operational routes — not in public nav */}
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/activate-account" element={<ActivateAccount />} />
        <Route path="/policies/terms" element={<Policies />} />
        <Route path="/policies" element={<Navigate to="/policies/terms" replace />} />
        <Route path="/license" element={<LicensePage />} />

        <Route path="/portal/*" element={<ClientPortalLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ClientDashboardPage />} />
          <Route path="reservations" element={<ClientReservationsPage />} />
          <Route path="profile" element={<ClientProfilePage />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>

        <Route path="/dashboard/admin/*" element={<AdminDashboard />} />
        <Route path="/dashboard/user" element={<Navigate to="/portal/dashboard" replace />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </div>
  );
}
