import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import FadeIn from '../components/FadeIn.jsx';
import NoticeBanner from '../components/NoticeBanner.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import AdminCalendar from './admin/AdminCalendar.jsx';
import AdminGallery from './admin/AdminGallery.jsx';
import AdminMenu from './admin/AdminMenu.jsx';
import AdminSpecials from './admin/AdminSpecials.jsx';
import ReservationDetails from './admin/ReservationDetails.jsx';
import AdminUserDetails from './admin/AdminUserDetails.jsx';
import { AdminDashboardProvider, useAdminDashboard, getAdminResourcesForPath } from './admin/AdminDashboardContext.jsx';

function AdminDashboardContent() {
  const location = useLocation();
  const {
    state: { currentAdmin, loading, error, notices },
    actions: { dismissNotice, prefetchResources }
  } = useAdminDashboard();

  useEffect(() => {
    if (loading) {
      return;
    }
    const path = location.pathname;
    const resources = getAdminResourcesForPath(path);
    prefetchResources(resources);
  }, [loading, location.pathname, prefetchResources]);

  if (loading) {
    return (
      <main className="bg-gray-50 py-16 text-gray-900">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-2 sm:px-2">
          <SectionTitle eyebrow="Admin" title="Studio control center" description="Loading secure tools..." />
        </div>
      </main>
    );
  }

  if (!currentAdmin) {
    return null;
  }

  return (
    <main className="bg-gray-50 py-16 text-gray-900">
      <FadeIn as="div" className="mx-auto max-w-6xl space-y-8 px-4 sm:px-6" childClassName="w-full">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
              Signed in as {currentAdmin.name}
            </p>
          </div>
        </div>


        {notices.length ? (
          <div className="space-y-3">
            {notices.map((notice) => (
              <NoticeBanner
                key={notice.id}
                tone={notice.tone}
                message={notice.message}
                autoHideAfter={notice.autoHideAfter}
                onDismiss={() => dismissNotice(notice.id)}
              />
            ))}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <Routes>
          <Route index element={<Navigate to="calendar" replace />} />
          <Route path="calendar" element={<AdminCalendar />} />
          <Route path="calendar/:reservationId" element={<ReservationDetails />} />
          <Route path="user/:userId" element={<AdminUserDetails />} />
          <Route path="gallery" element={<AdminGallery />} />
          <Route path="menu" element={<AdminMenu />} />
          <Route path="specials" element={<AdminSpecials />} />
          <Route path="*" element={<Navigate to="calendar" replace />} />
        </Routes>
      </FadeIn>
    </main>
  );
}

export default function AdminDashboard() {
  return (
    <AdminDashboardProvider>
      <AdminDashboardContent />
    </AdminDashboardProvider>
  );
}
