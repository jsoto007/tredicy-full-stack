import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/Button.jsx';
import Card from '../../components/Card.jsx';
import SectionTitle from '../../components/SectionTitle.jsx';
import { useAdminDashboard } from './AdminDashboardContext.jsx';

const METRIC_KEYS = [
  { key: 'total_users', label: 'Total users' },
  { key: 'total_guests', label: 'Guest accounts' },
  { key: 'total_admins', label: 'Admins' },
  { key: 'total_appointments', label: 'Appointments' },
  { key: 'pending_appointments', label: 'Pending requests' },
  { key: 'published_gallery_items', label: 'Published gallery items' }
];

export default function AdminSettings() {
  const {
    state: { overview, recentUsers, analytics, activityTracking, settings, users, pricing },
    actions: { refreshDashboardMetrics, refreshUsers, refreshHourlyRate, updateHourlyRate }
  } = useAdminDashboard();
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const [rateInput, setRateInput] = useState('');
  const [rateError, setRateError] = useState('');
  const [savingRate, setSavingRate] = useState(false);

  useEffect(() => {
    if (!users.length) {
      refreshUsers().catch(() => {});
    }
  }, [users.length, refreshUsers]);

  useEffect(() => {
    refreshHourlyRate().catch(() => {});
  }, [refreshHourlyRate]);

  useEffect(() => {
    if (pricing?.hourly_rate_cents != null) {
      setRateInput((pricing.hourly_rate_cents / 100).toFixed(2));
    }
  }, [pricing?.hourly_rate_cents]);

  const hourlyRateCurrency = pricing?.currency ?? 'USD';
  const hourlyRateFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: hourlyRateCurrency
      }),
    [hourlyRateCurrency]
  );
  const hourlyRateLabel =
    pricing?.hourly_rate_cents != null ? hourlyRateFormatter.format(pricing.hourly_rate_cents / 100) : 'Loading rate...';

  const handleRateSave = async () => {
    const normalized = rateInput.trim().replace(',', '.');
    if (!normalized) {
      setRateError('Hourly rate is required.');
      return;
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      setRateError('Enter a valid number.');
      return;
    }
    if (parsed <= 0) {
      setRateError('Hourly rate must be greater than zero.');
      return;
    }
    setRateError('');
    setSavingRate(true);
    try {
      await updateHourlyRate(Math.round(parsed * 100));
    } finally {
      setSavingRate(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const source = query && users.length ? users : recentUsers;
    const list = Array.isArray(source) ? source : [];
    if (!query) {
      return list;
    }
    return list.filter((user) => {
      const haystack = `${user?.display_name ?? ''} ${user?.email ?? ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [searchQuery, recentUsers, users]);

  const isSearching = Boolean(searchQuery.trim());
  const profileCountLabel = isSearching
    ? `${filteredUsers.length} match${filteredUsers.length === 1 ? '' : 'es'}`
    : `${recentUsers.length} profile${recentUsers.length === 1 ? '' : 's'}`;

  const handleUserNavigate = (userId) => {
    if (!userId) {
      return;
    }
    navigate(`/dashboard/admin/user/${userId}`);
  };

  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="Admin"
        title="Studio configuration"
        description="Monitor platform activity, adjust access, and review analytics in one place."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {METRIC_KEYS.map((metric) => (
          <Card key={metric.key} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
              {metric.label}
            </p>
            <p className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
              {overview?.[metric.key] ?? '—'}
            </p>
          </Card>
        ))}
      </div>

      <Card className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
              Recent users
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Browse the latest client profiles and open any record to manage access.
            </p>
          </div>
          <span className="text-xs uppercase tracking-[0.3em] text-gray-400 dark:text-gray-500">
            {profileCountLabel}
          </span>
        </div>
        <div>
          <label htmlFor="recent-users-search" className="sr-only">
            Search users
          </label>
          <input
            id="recent-users-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by name or email..."
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:focus:border-gray-400"
          />
        </div>
        {filteredUsers.length ? (
          <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
            {filteredUsers.map((user) => {
              return (
                <div
                  key={user.id}
                  className="rounded-xl border border-gray-200 bg-white/95 p-4 shadow-sm transition hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
                >
                  <button
                    type="button"
                    onClick={() => handleUserNavigate(user.id)}
                    className="group w-full text-left"
                  >
                    <p className="text-sm font-semibold text-gray-900 transition group-hover:text-gray-700 dark:text-gray-100 dark:group-hover:text-gray-200">
                      {user.display_name}
                    </p>
                    <p className="text-xs text-gray-500 transition group-hover:text-gray-600 dark:text-gray-400 dark:group-hover:text-gray-300">
                      {user.email}
                    </p>
                    <span className="mt-2 inline-flex items-center text-[11px] uppercase tracking-[0.3em] text-gray-400 transition group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-400">
                      {'View details ->'}
                    </span>
                  </button>
                  <div className="mt-3">
                    <p className="text-[11px] uppercase tracking-[0.25em] text-gray-400 dark:text-gray-500">Role</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.25em] text-gray-500 dark:text-gray-400">
                      {user.role}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            {isSearching ? 'No users match your search.' : 'No recent users to display.'}
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
            Appointments by status
          </h3>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
            {Object.entries(analytics.appointments_by_status || {}).map(([status, count]) => (
              <li
                key={status}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800"
              >
                <span className="uppercase tracking-[0.25em] text-xs text-gray-500 dark:text-gray-400">{status}</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{count}</span>
              </li>
            ))}
            {!Object.keys(analytics.appointments_by_status || {}).length ? (
              <li className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                No appointment data yet.
              </li>
            ) : null}
          </ul>
        </Card>
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
            Gallery items by category
          </h3>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
            {Object.entries(analytics.gallery_items_by_category || {}).map(([category, count]) => (
              <li
                key={category}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800"
              >
                <span className="uppercase tracking-[0.25em] text-xs text-gray-500 dark:text-gray-400">
                  {category}
                </span>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{count}</span>
              </li>
            ))}
            {!Object.keys(analytics.gallery_items_by_category || {}).length ? (
              <li className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                No gallery data yet.
              </li>
            ) : null}
          </ul>
        </Card>
      </div>

      <Card className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
          Security & activity
        </h3>
        <div className="space-y-3">
          {activityTracking.map((log) => (
            <div
              key={log.id}
              className="rounded-xl border border-gray-200 p-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
            >
              <p className="font-semibold text-gray-900 dark:text-gray-100">{log.action}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{log.details || 'No details provided.'}</p>
              <p className="text-[11px] uppercase tracking-[0.25em] text-gray-400 dark:text-gray-500">
                {log.admin?.name ?? 'System'} · {log.ip_address || 'n/a'} ·{' '}
                {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
              </p>
            </div>
          ))}
          {!activityTracking.length ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              No recent activity has been recorded.
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
              Pricing
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Adjust the hourly rate that the API uses to calculate session totals.
            </p>
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {hourlyRateLabel} / hr
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
          <label
            htmlFor="hourly-rate-input"
            className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
          >
            Hourly rate
          </label>
          <div className="sm:col-span-2 space-y-1">
            <input
              id="hourly-rate-input"
              type="text"
              value={rateInput}
              onChange={(event) => {
                setRateInput(event.target.value);
                setRateError('');
              }}
              placeholder="e.g. 220.00"
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
            />
            {rateError ? (
              <p className="text-xs uppercase tracking-[0.2em] text-rose-500 dark:text-rose-400">{rateError}</p>
            ) : null}
          </div>
          <Button type="button" onClick={handleRateSave} disabled={savingRate} className="w-full sm:w-auto">
            {savingRate ? 'Saving...' : 'Save rate'}
          </Button>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Session totals and quotes always come from the API so clients see the rate you set here.
        </p>
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
              System settings
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Reference configuration values loaded for the studio infrastructure.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={refreshDashboardMetrics}>
            Refresh
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {settings.map((setting) => (
            <div
              key={setting.id}
              className="rounded-xl border border-gray-200 p-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                {setting.key}
              </p>
              <p className="text-sm text-gray-900 dark:text-gray-100">{setting.value}</p>
              <p className="text-[11px] uppercase tracking-[0.25em] text-gray-400 dark:text-gray-500">
                {setting.is_editable ? 'Editable' : 'Locked'}
              </p>
            </div>
          ))}
          {!settings.length ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              Configuration values will appear once synced from the API.
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
