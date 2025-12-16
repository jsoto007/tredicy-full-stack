import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/Button.jsx';
import Card from '../../components/Card.jsx';
import Dialog from '../../components/Dialog.jsx';
import SectionTitle from '../../components/SectionTitle.jsx';
import { useAdminDashboard } from './AdminDashboardContext.jsx';
import { apiGet } from '../../lib/api.js';

const METRIC_KEYS = [
  { key: 'total_users', label: 'Total users' },
  { key: 'total_guests', label: 'Guest accounts' },
  { key: 'total_admins', label: 'Admins' },
  { key: 'total_appointments', label: 'Appointments' },
  { key: 'pending_appointments', label: 'Pending requests' },
  { key: 'published_gallery_items', label: 'Published gallery items' }
];

function formatDurationLabel(minutes) {
  if (!minutes || minutes <= 0) {
    return '0m';
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  const parts = [];
  if (hours) {
    parts.push(`${hours}h`);
  }
  if (remainder) {
    parts.push(`${remainder}m`);
  }
  return parts.join(' ') || '0m';
}

function toHoursInputValue(minutes) {
  if (!minutes || minutes <= 0) {
    return '';
  }
  const hours = minutes / 60;
  return hours.toFixed(2).replace(/\.?0+$/, '');
}

function normalizeDecimalInput(value) {
  return value.replace(',', '.');
}

const INITIAL_SESSION_DRAFT = {
  id: null,
  name: '',
  durationHours: '',
  price: '',
  is_active: true
};

function buildSessionPayload(input) {
  if (!input) {
    return { error: 'Session data is missing.' };
  }
  const durationValue = Number(normalizeDecimalInput((input.durationHours || '').trim()));
  if (!input.durationHours || Number.isNaN(durationValue) || durationValue <= 0) {
    return { error: 'Enter a valid duration in hours.' };
  }
  const priceInput = normalizeDecimalInput((input.price ?? '').trim());
  const priceValue = Number(priceInput);
  if (priceInput === '' || Number.isNaN(priceValue) || priceValue < 0) {
    return { error: 'Enter a valid price (zero allowed for consultations).' };
  }
  return {
    payload: {
      name: (input.name || '').trim() || null,
      duration_minutes: Math.max(1, Math.round(durationValue * 60)),
      price_cents: Math.round(priceValue * 100),
      is_active: Boolean(input.is_active)
    }
  };
}

const WEEKDAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const WEEKDAY_LABELS = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday'
};

const ADMIN_HOUR_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit'
});

function parseOperatingHoursValue(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return [];
    }
  }
  return [];
}

function formatAdminTimeValue(value) {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    const [hours, minutes] = value.split(':').map(Number);
    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      return ADMIN_HOUR_FORMATTER.format(date);
    }
    return value;
  }
  if (typeof value === 'object') {
    const hours =
      Number(
        value.hour ??
          (typeof value.getHours === 'function' ? value.getHours() : undefined)
      );
    const minutes =
      Number(
        value.minute ??
          (typeof value.getMinutes === 'function' ? value.getMinutes() : undefined)
      );
    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      return ADMIN_HOUR_FORMATTER.format(date);
    }
    if (typeof value.toString === 'function') {
      return value.toString();
    }
  }
  return String(value);
}

function buildOperatingHoursRows(value) {
  const entries = parseOperatingHoursValue(value);
  const normalized = new Map();
  entries.forEach((entry) => {
    if (!entry || typeof entry !== 'object') {
      return;
    }
    const rawDay = String(entry.day ?? entry.label ?? entry.weekday ?? entry.key ?? '')
      .toLowerCase()
      .trim();
    if (!rawDay) {
      return;
    }
    normalized.set(rawDay, entry);
  });

  return WEEKDAY_KEYS.map((dayKey) => {
    const entry = normalized.get(dayKey);
    const dayLabel = WEEKDAY_LABELS[dayKey] ?? dayKey;
    if (!entry) {
      return {
        key: dayKey,
        dayLabel,
        detail: 'Closed',
        isOpen: false
      };
    }
    let isOpen = true;
    if (typeof entry.is_open === 'boolean') {
      isOpen = entry.is_open;
    } else if (typeof entry.is_open === 'string') {
      isOpen = entry.is_open.toLowerCase() !== 'false';
    }
    if (entry.is_closed === true || entry.closed === true) {
      isOpen = false;
    }
    const openLabel = formatAdminTimeValue(
      entry.open_time ?? entry.open ?? entry.from ?? entry.start ?? entry.opens_at ?? entry.open_time_str
    );
    const closeLabel = formatAdminTimeValue(
      entry.close_time ?? entry.close ?? entry.to ?? entry.end ?? entry.closes_at ?? entry.close_time_str
    );
    let detail = 'Hours not set';
    if (!isOpen) {
      detail = 'Closed';
    } else if (openLabel && closeLabel) {
      detail = `${openLabel} – ${closeLabel}`;
    } else if (openLabel) {
      detail = `Opens at ${openLabel}`;
    } else if (closeLabel) {
      detail = `Closes at ${closeLabel}`;
    }
    return {
      key: dayKey,
      dayLabel,
      detail,
      isOpen
    };
  });
}

function formatSettingLabel(key) {
  if (!key || typeof key !== 'string') return '';
  const normalized = key.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function AdminSettings() {
  const {
    state: { overview, recentUsers, analytics, activityTracking, settings, users, pricing },
    actions: {
      refreshDashboardMetrics,
      refreshUsers,
      refreshHourlyRate,
      updateHourlyRate,
      createSessionOption,
      updateSessionOption,
      deleteSessionOption,
      updateBookingFee
    }
  } = useAdminDashboard();
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const [rateInput, setRateInput] = useState('');
  const [rateError, setRateError] = useState('');
  const [savingRate, setSavingRate] = useState(false);
  const [bookingFeeInput, setBookingFeeInput] = useState('');
  const [bookingFeeError, setBookingFeeError] = useState('');
  const [savingBookingFee, setSavingBookingFee] = useState(false);
  const [sessionForm, setSessionForm] = useState(() => ({ ...INITIAL_SESSION_DRAFT }));
  const [sessionFormError, setSessionFormError] = useState('');
  const [sessionSaving, setSessionSaving] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState(() => ({ ...INITIAL_SESSION_DRAFT }));
  const [modalError, setModalError] = useState('');
  const [modalSaving, setModalSaving] = useState(false);
  const [visibilityUpdatingId, setVisibilityUpdatingId] = useState(null);
  const [optimisticVisibility, setOptimisticVisibility] = useState(() => new Map());
  const [adminSessionOptions, setAdminSessionOptions] = useState([]);
  const [, setAdminSessionLoading] = useState(false);
  const [, setAdminSessionError] = useState('');

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

  useEffect(() => {
    if (pricing?.booking_fee_percent != null) {
      setBookingFeeInput(String(pricing.booking_fee_percent));
    }
  }, [pricing?.booking_fee_percent]);

  const sessionOptions = pricing?.session_options ?? [];
  const pricingCurrency = pricing?.currency ?? 'USD';
  const operatingHoursSetting = useMemo(
    () => settings.find((setting) => setting.key === 'studio_operating_hours'),
    [settings]
  );
  const operatingHoursRows = useMemo(
    () => buildOperatingHoursRows(operatingHoursSetting?.value),
    [operatingHoursSetting?.value]
  );
  const pricingFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: pricingCurrency
      }),
    [pricingCurrency]
  );

  const displaySessionOptions = adminSessionOptions.length ? adminSessionOptions : sessionOptions;

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

  const handleBookingFeeSave = async () => {
    const normalized = normalizeDecimalInput((bookingFeeInput || '').trim());
    if (!normalized) {
      setBookingFeeError('Booking fee is required.');
      return;
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      setBookingFeeError('Enter a valid number.');
      return;
    }
    if (parsed < 20) {
      setBookingFeeError('Booking fee must be at least 20%.');
      return;
    }
    setBookingFeeError('');
    setSavingBookingFee(true);
    try {
      await updateBookingFee(Math.round(parsed));
    } finally {
      setSavingBookingFee(false);
    }
  };

  const resetSessionForm = () => {
    setSessionForm({
      id: null,
      name: '',
      durationHours: '',
      price: '',
      is_active: true
    });
    setSessionFormError('');
  };

  const fetchAdminSessionOptions = useCallback(async () => {
    setAdminSessionLoading(true);
    try {
      const data = await apiGet('/api/admin/pricing/session-options');
      setAdminSessionOptions(Array.isArray(data) ? data : []);
      setAdminSessionError('');
    } catch (fetchError) {
      setAdminSessionError('Unable to load session options.');
    } finally {
      setAdminSessionLoading(false);
    }
  }, []);

  const handleSessionFormChange = (field) => (event) => {
    const value = field === 'is_active' ? event.target.checked : event.target.value;
    setSessionForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleModalFormChange = (field) => (event) => {
    const value = field === 'is_active' ? event.target.checked : event.target.value;
    setModalForm((prev) => ({ ...prev, [field]: value }));
    setModalError('');
  };

  const handleSessionEdit = (option) => {
    setSessionForm({
      id: option.id,
      name: option.name || '',
      durationHours: toHoursInputValue(option.duration_minutes),
      price: option.price_cents ? (option.price_cents / 100).toFixed(2).replace(/\.?0+$/, '') : '',
      is_active: Boolean(option.is_active)
    });
    setSessionFormError('');
  };

  const openSessionModal = () => {
    setModalError('');
    setModalForm({ ...INITIAL_SESSION_DRAFT });
    setIsSessionModalOpen(true);
  };

  const closeSessionModal = () => {
    setModalForm({ ...INITIAL_SESSION_DRAFT });
    setModalError('');
    setIsSessionModalOpen(false);
  };

  useEffect(() => {
    fetchAdminSessionOptions();
  }, [fetchAdminSessionOptions]);

  const handleSessionDelete = async (option) => {
    if (!window.confirm('Remove this session option? Existing bookings will retain their original data.')) {
      return;
    }
    try {
      await deleteSessionOption(option.id);
      if (sessionForm.id === option.id) {
        resetSessionForm();
      }
      fetchAdminSessionOptions().catch(() => {});
    } catch (error) {
      // Errors are surfaced through notices.
    }
  };

  const getOptionActiveState = (option) => {
    if (!option || typeof option.id !== 'number') {
      return false;
    }
    if (optimisticVisibility.has(option.id)) {
      return optimisticVisibility.get(option.id);
    }
    return Boolean(option.is_active);
  };

  useEffect(() => {
    if (!optimisticVisibility.size) {
      return;
    }
    setOptimisticVisibility((prev) => {
      const next = new Map(prev);
      let changed = false;
      displaySessionOptions.forEach((option) => {
        if (!next.has(option.id)) {
          return;
        }
        if (next.get(option.id) === Boolean(option.is_active)) {
          next.delete(option.id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [displaySessionOptions, optimisticVisibility]);

  const handleVisibilityToggle = async (option) => {
    if (!option || typeof option.id !== 'number') {
      return;
    }
    const previousActive = getOptionActiveState(option);
    const nextActive = !previousActive;
    setOptimisticVisibility((prev) => {
      const next = new Map(prev);
      next.set(option.id, nextActive);
      return next;
    });
    setVisibilityUpdatingId(option.id);
    try {
      await updateSessionOption(option.id, { is_active: nextActive });
      await fetchAdminSessionOptions();
    } catch (error) {
      setOptimisticVisibility((prev) => {
        const next = new Map(prev);
        next.set(option.id, previousActive);
        return next;
      });
    } finally {
      setVisibilityUpdatingId(null);
    }
  };

  const handleSessionSave = async () => {
    setSessionFormError('');
    const { payload, error } = buildSessionPayload(sessionForm);
    if (error) {
      setSessionFormError(error);
      return;
    }
    setSessionSaving(true);
    try {
      if (sessionForm.id) {
        await updateSessionOption(sessionForm.id, payload);
      } else {
        await createSessionOption(payload);
      }
      resetSessionForm();
      await fetchAdminSessionOptions();
    } finally {
      setSessionSaving(false);
    }
  };

  const handleSessionModalSave = async () => {
    setModalError('');
    const { payload, error } = buildSessionPayload(modalForm);
    if (error) {
      setModalError(error);
      return;
    }
    setModalSaving(true);
    try {
      await createSessionOption(payload);
      closeSessionModal();
      await fetchAdminSessionOptions();
    } catch (saveError) {
      // Errors are surfaced through notices.
    } finally {
      setModalSaving(false);
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
              Booking fee
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Determine how much of each session is collected when a client reserves time.
            </p>
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {pricing?.booking_fee_percent ? `${pricing.booking_fee_percent}% now` : 'Loading…'}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
          <label
            htmlFor="booking-fee-input"
            className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
          >
            Booking fee (%)
          </label>
          <div className="sm:col-span-2 space-y-1">
            <input
              id="booking-fee-input"
              type="text"
              value={bookingFeeInput}
              onChange={(event) => {
                setBookingFeeInput(event.target.value);
                setBookingFeeError('');
              }}
              placeholder="e.g. 25"
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
            />
            {bookingFeeError ? (
              <p className="text-xs uppercase tracking-[0.2em] text-rose-500 dark:text-rose-400">{bookingFeeError}</p>
            ) : (
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                Minimum 20%. Clients can opt to pay the remaining balance later or cover the full amount now.
              </p>
            )}
          </div>
          <Button type="button" onClick={handleBookingFeeSave} disabled={savingBookingFee} className="w-full sm:w-auto">
            {savingBookingFee ? 'Saving...' : 'Save fee'}
          </Button>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
              Session options
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Define the durations, prices, and visibility that clients see when booking.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={openSessionModal}>
            Add session option
          </Button>
        </div>
        <div className="space-y-3">
          {displaySessionOptions.length ? (
            displaySessionOptions.map((option) => {
              const optionLabel = option.name || `${formatDurationLabel(option.duration_minutes)} session`;
              const isEditing = sessionForm.id === option.id;
              const isActive = getOptionActiveState(option);
              const visibilityStatusLabel = isActive ? 'Visible to clients' : 'Visible for admins only';
              return (
                <div
                  key={option.id}
                  className={`flex flex-col gap-3 rounded-2xl border bg-white/80 p-4 shadow-sm transition hover:border-gray-300 dark:bg-gray-950 dark:hover:border-gray-700 ${
                    isEditing ? 'border-indigo-500/40 dark:border-indigo-400/40' : 'border-gray-200 dark:border-gray-800'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{optionLabel}</p>
                      <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                        {formatDurationLabel(option.duration_minutes)} ·{' '}
                        {pricingFormatter.format((option.price_cents ?? 0) / 100)}
                      </p>
                    </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={visibilityUpdatingId === option.id}
              onClick={() => handleVisibilityToggle(option)}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] transition-colors duration-200 focus:outline-none ${
                isActive
                  ? 'border-emerald-500 text-emerald-500 hover:bg-emerald-500/10 focus-visible:ring-2 focus-visible:ring-emerald-400'
                  : 'border-gray-300 text-gray-500 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-white/10 dark:focus-visible:ring-2 dark:focus-visible:ring-white/30'
              }`}
            >
              {visibilityUpdatingId === option.id
                ? 'Updating…'
                : isActive
                ? 'Visible to clients'
                : 'Show to clients'}
            </button>
                      {!isEditing ? (
                        <Button type="button" variant="secondary" onClick={() => handleSessionEdit(option)}>
                          Edit
                        </Button>
                      ) : null}
                      <Button type="button" variant="ghost" onClick={() => handleSessionDelete(option)}>
                        Remove
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-gray-500 dark:text-gray-400">
                    <span
                      className={`h-2 w-2 rounded-full transition-colors ${
                        isActive ? 'bg-emerald-500' : 'bg-gray-400 dark:bg-gray-500'
                      }`}
                    />
                    <span>{visibilityStatusLabel}</span>
                  </div>
                  {!isActive ? (
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">Still listed for admins while hidden from the booking form.</p>
                  ) : null}
                  {isEditing ? (
                    <div className="space-y-3 rounded-2xl border-t border-gray-200/70 pt-4 transition dark:border-gray-800/60">
                      <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
                        <label
                          htmlFor="inline-session-name-input"
                          className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
                        >
                          Label (optional)
                        </label>
                        <div className="sm:col-span-2">
                          <input
                            id="inline-session-name-input"
                            type="text"
                            value={sessionForm.name}
                            onChange={handleSessionFormChange('name')}
                            placeholder="e.g. Two-hour sitting"
                            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
                          />
                        </div>
                        <label
                          htmlFor="inline-session-duration-input"
                          className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
                        >
                          Duration (hours)
                        </label>
                        <div className="sm:col-span-2">
                          <input
                            id="inline-session-duration-input"
                            type="text"
                            value={sessionForm.durationHours}
                            onChange={handleSessionFormChange('durationHours')}
                            placeholder="e.g. 1.5"
                            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
                          />
                        </div>
                        <label
                          htmlFor="inline-session-price-input"
                          className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
                        >
                          Price (USD)
                        </label>
                        <div className="sm:col-span-2">
                          <input
                            id="inline-session-price-input"
                            type="text"
                            value={sessionForm.price}
                            onChange={handleSessionFormChange('price')}
                            placeholder="e.g. 175.00 or 0 for consults"
                            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                            <input
                              type="checkbox"
                              checked={sessionForm.is_active}
                              onChange={handleSessionFormChange('is_active')}
                              className="h-4 w-4 rounded border border-gray-400 text-gray-900 focus:ring-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:focus:ring-gray-400"
                            />
                            Visible to clients
                          </label>
                        </div>
                      </div>
                      {sessionFormError ? (
                        <p className="text-xs uppercase tracking-[0.2em] text-rose-500 dark:text-rose-400">{sessionFormError}</p>
                      ) : null}
                      <div className="flex flex-wrap gap-3">
                        <Button type="button" onClick={handleSessionSave} disabled={sessionSaving}>
                          {sessionSaving ? 'Saving...' : 'Save changes'}
                        </Button>
                        <Button type="button" variant="ghost" onClick={resetSessionForm} disabled={sessionSaving}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 p-4 text-xs uppercase tracking-[0.3em] text-gray-500 dark:border-gray-700 dark:text-gray-400">
              Create a session type to make durations and pricing available on the booking form.
            </div>
          )}
        </div>
      </Card>

      <Dialog
        open={isSessionModalOpen}
        onClose={closeSessionModal}
        title="Add session option"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={closeSessionModal} disabled={modalSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSessionModalSave} disabled={modalSaving}>
              {modalSaving ? 'Saving...' : 'Create option'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
          <div className="space-y-1">
            <label htmlFor="session-modal-name" className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
              Label (optional)
            </label>
            <input
              id="session-modal-name"
              type="text"
              value={modalForm.name}
              onChange={handleModalFormChange('name')}
              placeholder="e.g. Two-hour sitting"
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="session-modal-duration" className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
              Duration (hours)
            </label>
            <input
              id="session-modal-duration"
              type="text"
              value={modalForm.durationHours}
              onChange={handleModalFormChange('durationHours')}
              placeholder="e.g. 1.5"
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="session-modal-price" className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
              Price (USD)
            </label>
            <input
              id="session-modal-price"
              type="text"
              value={modalForm.price}
              onChange={handleModalFormChange('price')}
              placeholder="e.g. 175.00 or 0 for consults"
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
            <input
              type="checkbox"
              checked={modalForm.is_active}
              onChange={handleModalFormChange('is_active')}
              className="h-4 w-4 rounded border border-gray-400 text-gray-900 dark:border-gray-600 dark:bg-gray-900"
            />
            Visible to clients
          </label>
        </div>
        {modalError ? (
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-rose-500 dark:text-rose-400">{modalError}</p>
        ) : null}
      </Dialog>

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
        <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
          Security & activity
        </h3>
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
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
            {settings.map((setting) => {
              if (setting.key === 'studio_operating_hours') {
                return (
                  <div
                    key={setting.id}
                    className="rounded-xl border border-gray-200 p-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200 sm:col-span-2 lg:col-span-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                      Studio Operating Hours
                    </p>
                    <ul className="mt-2 divide-y divide-gray-200 text-xs text-gray-700 dark:divide-gray-800 dark:text-gray-200">
                      {operatingHoursRows.map((row) => (
                        <li key={`${row.key}-${row.detail}`} className="flex items-center justify-between py-1.5">
                          <span className="font-medium uppercase tracking-[0.3em]">{row.dayLabel}</span>
                          <span className="text-gray-500 dark:text-gray-400">{row.detail}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-[11px] uppercase tracking-[0.25em] text-gray-400 dark:text-gray-500">
                      Display-only snapshot of studio availability.
                    </p>
                  </div>
                );
              }

              // Special handling for studio hourly rate (stored in cents)
              let valueNode = null;
            if (setting.key === 'studio_hourly_rate_cents') {
              const rawValue = typeof setting.value === 'string' ? parseFloat(setting.value) : setting.value;
              let formatted = String(setting.value ?? '');
              if (Number.isFinite(rawValue)) {
                const dollars = rawValue / 100;
                formatted = new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: hourlyRateCurrency
                }).format(dollars);
              }
              valueNode = (
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {formatted} <span className="text-xs text-gray-500 dark:text-gray-400">/ hr</span>
                </p>
              );
            } else {
              valueNode = (
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {String(setting.value)}
                </p>
              );
            }

            return (
              <div
                key={setting.id}
                className="rounded-xl border border-gray-200 p-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                  {formatSettingLabel(setting.key)}
                </p>
                {valueNode}
                <p className="text-[11px] uppercase tracking-[0.25em] text-gray-400 dark:text-gray-500">
                  {setting.is_editable ? 'Editable' : 'Locked'}
                </p>
              </div>
            );
          })}
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
