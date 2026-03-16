import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import ScrollRestoration from './components/ScrollRestoration.jsx';
import Landing from './pages/Landing.jsx';
import ActivateAccount from './pages/ActivateAccount.jsx';
import AuthPage from './pages/AuthPage.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import ClientPortalLayout from './pages/portal/ClientPortalLayout.jsx';
import ClientDashboardPage from './pages/portal/ClientDashboardPage.jsx';
import ClientAppointmentsPage from './pages/portal/ClientAppointmentsPage.jsx';
import ClientProfilePage from './pages/portal/ClientProfilePage.jsx';
import ShareYourIdea from './pages/ShareYourIdea.jsx';
import BookingConfirmation from './pages/BookingConfirmation.jsx';
import BlogLayout from './pages/blog/BlogLayout.jsx';
import BlogIndex from './pages/blog/BlogIndex.jsx';
import TattooAftercare from './pages/blog/TattooAftercare.jsx';
import TattooFaq from './pages/blog/TattooFaq.jsx';
import CustomFineLine from './pages/blog/CustomFineLine.jsx';
import Policies from './pages/Policies.jsx';

export default function App() {
  const location = useLocation();
  const isPortalRoute = location.pathname.startsWith('/portal');

  return (
    <div className="min-h-screen bg-white text-gray-900 transition-colors duration-300">
      <div id="top" className="sr-only" tabIndex="-1" aria-label="Top of page">
        Top
      </div>
      {!isPortalRoute && <Header />}
      <ScrollRestoration />
      <Routes>
        <Route path="/portal/*" element={<ClientPortalLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ClientDashboardPage />} />
          <Route path="appointments" element={<ClientAppointmentsPage />} />
          <Route path="profile" element={<ClientProfilePage />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/activate-account" element={<ActivateAccount />} />
        <Route path="/share-your-idea" element={<ShareYourIdea />} />
        <Route path="/booking/confirmation" element={<BookingConfirmation />} />
        <Route path="/policies" element={<Navigate to="/policies/terms" replace />} />
        <Route path="/policies/terms" element={<Policies />} />
        <Route path="/blog" element={<BlogLayout />}>
          <Route index element={<BlogIndex />} />
          <Route path="aftercare" element={<TattooAftercare />} />
          <Route path="faq" element={<TattooFaq />} />
          <Route path="custom-fine-line" element={<CustomFineLine />} />
        </Route>
        <Route path="/dashboard/user" element={<Navigate to="/portal/dashboard" replace />} />
        <Route path="/dashboard/admin/*" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!isPortalRoute && <Footer />}
    </div>
  );
}
