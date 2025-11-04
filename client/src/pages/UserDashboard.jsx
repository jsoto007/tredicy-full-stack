import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import FadeIn from '../components/FadeIn.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import { apiGet, apiPost } from '../lib/api.js';

export default function UserDashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [notifications, setNotifications] = useState({ items: [], unread_count: 0 });
  const [appointments, setAppointments] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function bootstrap() {
      try {
        setLoading(true);
        const session = await apiGet('/api/auth/session');
        if (ignore) {
          return;
        }
        if (session?.role !== 'user') {
          navigate('/auth', { replace: true });
          return;
        }
        const data = await apiGet('/api/dashboard/user');
        if (ignore) {
          return;
        }
        setProfile(data.profile);
        setNotifications(data.notifications);
        setAppointments(data.appointments);
        setActions(data.recent_actions);
        setError(null);
      } catch (err) {
        if (!ignore) {
          if (err.status === 401) {
            navigate('/auth', { replace: true });
          } else {
            setError('Unable to load your dashboard right now.');
          }
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      ignore = true;
    };
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await apiPost('/api/auth/logout', {});
    } catch {
      // Ignore logout failures
    } finally {
      navigate('/auth', { replace: true });
    }
  };

  if (loading) {
    return (
      <main className="bg-white py-16 text-gray-900 dark:bg-black dark:text-gray-100">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6">
          <SectionTitle eyebrow="Dashboard" title="Personal portal" description="Loading your account..." />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="bg-white py-16 text-gray-900 dark:bg-black dark:text-gray-100">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6">
          <SectionTitle eyebrow="Dashboard" title="Personal portal" description="We hit a snag." />
          <Card className="text-xs uppercase tracking-[0.3em] text-rose-600 dark:text-rose-300">{error}</Card>
          <Button onClick={() => navigate('/auth', { replace: true })}>Return to sign in</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-white py-16 text-gray-900 dark:bg-black dark:text-gray-100">
      <FadeIn as="div" className="mx-auto flex max-w-5xl flex-col gap-8 px-6" childClassName="w-full">
        <SectionTitle
          eyebrow="Dashboard"
          title="Welcome back"
          description="Track appointments, updates, and follow-up actions from your personalized dashboard."
        />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Signed in as</p>
            <p className="text-sm text-gray-700 dark:text-gray-200">{profile?.display_name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{profile?.email}</p>
          </div>
          <Button variant="secondary" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="space-y-3 bg-gray-50 dark:bg-gray-900">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
              Notifications
            </h2>
            {notifications.items.length ? (
              <ul className="space-y-3">
                {notifications.items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-gray-200 p-3 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-200"
                  >
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">No alerts yet.</p>
            )}
          </Card>
          <Card className="space-y-3 bg-gray-50 dark:bg-gray-900">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
              Recent appointments
            </h2>
            {appointments.length ? (
              <ul className="space-y-3">
                {appointments.map((appointment) => (
                  <li
                    key={appointment.id}
                    className="rounded-xl border border-gray-200 p-3 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-200"
                  >
                    <p className="font-medium">
                      {appointment.reference_code || `Appointment ${appointment.id}`} · {appointment.status}
                    </p>
                    {appointment.scheduled_start ? (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {new Date(appointment.scheduled_start).toLocaleString()}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                You have no sessions yet.
              </p>
            )}
          </Card>
        </div>
        <Card className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
            Quick actions
          </h2>
          <ul className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
            {actions.map((action) => (
              <li key={action.path} className="rounded-full border border-gray-300 px-4 py-2 dark:border-gray-700">
                {action.label}
              </li>
            ))}
          </ul>
        </Card>
      </FadeIn>
    </main>
  );
}
