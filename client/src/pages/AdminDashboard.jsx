import { Navigate, Route, Routes } from 'react-router-dom';
import SectionTitle from '../components/SectionTitle.jsx';
import AdminCalendar from './admin/AdminCalendar.jsx';
import AdminGallery from './admin/AdminGallery.jsx';
import AdminSettings from './admin/AdminSettings.jsx';
import AppointmentDetails from './admin/AppointmentDetails.jsx';
import { AdminDashboardProvider, useAdminDashboard } from './admin/AdminDashboardContext.jsx';

function FeedbackBanner({ feedback, onDismiss }) {
  if (!feedback) {
    return null;
  }

  const toneClasses =
    feedback.tone === 'success'
      ? 'border-green-500 bg-green-50 text-green-700 dark:border-green-600 dark:bg-green-950/50 dark:text-green-300'
      : 'border-amber-500 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-300';

  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-sm ${toneClasses}`}
      role="status"
    >
      <p>{feedback.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="text-xs uppercase tracking-[0.3em] underline"
      >
        Dismiss
      </button>
    </div>
  );
}

function AdminDashboardContent() {
  const {
    state: { currentAdmin, loading, error, feedback },
    actions: { clearFeedback, logout }
  } = useAdminDashboard();

  if (loading && !currentAdmin) {
    return (
      <main className="bg-gray-50 py-16 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
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
    <main className="bg-gray-50 py-16 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
              Signed in as {currentAdmin.name}
            </p>
          </div>
        </div>

        {feedback ? <FeedbackBanner feedback={feedback} onDismiss={clearFeedback} /> : null}
        {error ? (
          <div className="rounded-2xl border border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-600 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <Routes>
          <Route index element={<Navigate to="settings" replace />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="calendar" element={<AdminCalendar />} />
          <Route path="calendar/:appointmentId" element={<AppointmentDetails />} />
          <Route path="gallery" element={<AdminGallery />} />
          <Route path="*" element={<Navigate to="settings" replace />} />
        </Routes>
      </div>
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
