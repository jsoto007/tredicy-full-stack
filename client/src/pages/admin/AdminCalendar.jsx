import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/Button.jsx';
import Card from '../../components/Card.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import Dialog from '../../components/Dialog.jsx';
import SectionTitle from '../../components/SectionTitle.jsx';
import { useAdminDashboard } from './AdminDashboardContext.jsx';
import { getReservationTypeLabel } from '../../lib/reservations.js';
import { formatStatusLabel, getStatusBadgeClasses } from '../../lib/statusStyles.js';

const NEW_APPOINTMENT_TEMPLATE = {
  client_id: '',
  guest_name: '',
  guest_email: '',
  guest_phone: '',
  status: 'pending',
  scheduled_start: '',
  duration_minutes: '',
  assigned_admin_id: '',
  client_description: ''
};

const NEW_APPOINTMENT_FIELD_IDS = {
  clientId: 'new-reservation-client-id',
  status: 'new-reservation-status',
  guestName: 'new-reservation-guest-name',
  guestEmail: 'new-reservation-guest-email',
  scheduledStart: 'new-reservation-scheduled-start',
  duration: 'new-reservation-duration',
  assignedAdmin: 'new-reservation-assigned-admin',
  guestPhone: 'new-reservation-guest-phone',
  description: 'new-reservation-description'
};

const WEEK_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const WEEK_LABELS = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday'
};

const MINIMUM_APPOINTMENT_DURATION_MINUTES = 60;
const SLOT_INTERVAL_MINUTES = 60;

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' }
];

import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { format, addMinutes, startOfDay, getDay, addDays, startOfMonth } from 'date-fns';

const TIMEZONE = 'America/New_York';

function formatNycDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatInTimeZone(date, TIMEZONE, "yyyy-MM-dd'T'HH:mm");
}

function toNycInput(value) {
  return formatNycDateTime(value) || '';
}

function fromNycInput(value) {
  if (!value) return null;
  // Treat input string as NYC time and convert to UTC ISO string
  const zoned = fromZonedTime(value, TIMEZONE);
  return zoned.toISOString();
}

function formatClosureDate(value) {
  if (!value) {
    return '';
  }
  const [year, month, day] = value.split('-').map((segment) => Number(segment));
  if (![year, month, day].every(Number.isFinite)) {
    return value;
  }
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatNycDateKey(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd');
}

// Helper to get a Date object representing the start of the day in NYC
function startOfDayNyc(source) {
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return null;

  // Convert to zoned time, set to midnight, convert back to get the instant
  const zoned = toZonedTime(date, TIMEZONE);
  const start = startOfDay(zoned);
  // We want to return a date object that *behaves* like the start of the day in the calendar logic.
  // The existing logic seems to rely on local date objects. 
  // To keep it simple for the calendar grid which just needs "days", we can stick to the existing approach 
  // but be careful about crossing DST boundaries if we were doing strict math.
  // However, since we are replacing the whole block, let's use date-fns which is more robust.
  return start;
}

function startOfWeekNyc(source) {
  const start = startOfDayNyc(source);
  if (!start) return null;
  const day = getDay(start); // 0 = Sunday
  const offset = day === 0 ? -6 : 1 - day; // Monday is 1
  return addDays(start, offset);
}

function startOfMonthNyc(source) {
  const start = startOfDayNyc(source);
  if (!start) return null;
  return startOfMonth(start);
}

function getMonthGridDaysNyc(source) {
  const monthStart = startOfMonthNyc(source);
  if (!monthStart) return [];
  const gridStart = startOfWeekNyc(monthStart);
  if (!gridStart) return [];

  const days = [];
  for (let i = 0; i < 42; i++) {
    days.push(addDays(gridStart, i));
  }
  return days;
}

function formatReservationTimeRange(reservation) {
  if (!reservation?.scheduled_start) {
    return 'Awaiting schedule';
  }
  const start = new Date(reservation.scheduled_start);
  if (Number.isNaN(start.getTime())) {
    return 'Awaiting schedule';
  }
  const end = addMinutes(start, reservation.duration_minutes || SLOT_INTERVAL_MINUTES);

  const startStr = formatInTimeZone(start, TIMEZONE, 'h:mm a');
  const endStr = formatInTimeZone(end, TIMEZONE, 'h:mm a');

  return `${startStr} – ${endStr}`;
}

function buildReservationUpdatePayload(reservation, draft) {
  if (!reservation) {
    return null;
  }

  const payload = {};

  const normalizedStatus = (draft.status ?? '').trim() || 'pending';
  if (normalizedStatus !== (reservation.status || 'pending')) {
    payload.status = normalizedStatus;
  }

  const originalStartLocal = toNycInput(reservation.scheduled_start) || '';
  const draftStartLocal = draft.scheduled_start || '';
  if (draftStartLocal !== originalStartLocal) {
    payload.scheduled_start = draftStartLocal ? fromNycInput(draftStartLocal) : null;
  }

  const originalDuration = reservation.duration_minutes ?? null;
  const durationRaw = draft.duration_minutes;
  const parsedDuration =
    durationRaw === '' || durationRaw === null || durationRaw === undefined ? null : Number(durationRaw);
  const normalizedDuration = Number.isFinite(parsedDuration) ? parsedDuration : null;
  if (normalizedDuration !== originalDuration) {
    payload.duration_minutes = normalizedDuration;
  }

  const originalAssignedId = reservation.assigned_admin?.id ?? null;
  const assignedRaw = draft.assigned_admin_id;
  const parsedAssigned =
    assignedRaw === '' || assignedRaw === null || assignedRaw === undefined ? null : Number(assignedRaw);
  const normalizedAssigned = Number.isFinite(parsedAssigned) ? parsedAssigned : null;
  if (normalizedAssigned !== originalAssignedId) {
    payload.assigned_admin_id = normalizedAssigned;
  }

  const originalNotes = reservation.client_description || null;
  const normalizedNotes = draft.client_description?.trim() || null;
  if (normalizedNotes !== originalNotes) {
    payload.client_description = normalizedNotes;
  }

  return payload;
}

function buildReservationCreatePayload(draft) {
  return {
    status: draft.status?.trim() || 'pending',
    client_id: draft.client_id ? Number(draft.client_id) : undefined,
    guest_name: draft.guest_name?.trim() || undefined,
    guest_email: draft.guest_email?.trim() || undefined,
    guest_phone: draft.guest_phone?.trim() || undefined,
    scheduled_start: draft.scheduled_start ? fromNycInput(draft.scheduled_start) : null,
    duration_minutes: draft.duration_minutes ? Number(draft.duration_minutes) : null,
    assigned_admin_id: draft.assigned_admin_id ? Number(draft.assigned_admin_id) : null,
    client_description: draft.client_description?.trim() || undefined
  };
}

function isHourAligned(value) {
  if (!value) return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getMinutes() === 0 && date.getSeconds() === 0;
}

function alignScheduledStartInput(value) {
  if (!value) return '';
  if (isHourAligned(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  date.setMinutes(0, 0, 0);
  // Re-format using the same 'yyy-MM-ddTHH:mm' style
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

function alignDurationInput(value) {
  if (!value) {
    return '';
  }
  const minutes = Number(value);
  if (Number.isNaN(minutes) || minutes <= 0) {
    return '';
  }
  const aligned = Math.max(
    MINIMUM_APPOINTMENT_DURATION_MINUTES,
    Math.ceil(minutes / SLOT_INTERVAL_MINUTES) * SLOT_INTERVAL_MINUTES
  );
  return String(aligned);
}

function normaliseOperatingHours(hours) {
  const incoming = new Map();
  ensureArray(hours).forEach((entry) => {
    if (entry?.day) {
      incoming.set(entry.day, {
        day: entry.day,
        is_open: Boolean(entry.is_open),
        open_time: entry.open_time || '',
        close_time: entry.close_time || ''
      });
    }
  });
  return WEEK_ORDER.map((day) => {
    if (incoming.has(day)) {
      return { ...incoming.get(day) };
    }
    return {
      day,
      is_open: false,
      open_time: '',
      close_time: ''
    };
  });
}

function ensureArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value;
}

function buildDraftFromReservation(reservation) {
  return {
    status: reservation.status || 'pending',
    scheduled_start: toNycInput(reservation.scheduled_start),
    duration_minutes: reservation.duration_minutes ?? '',
    assigned_admin_id: reservation.assigned_admin?.id ? String(reservation.assigned_admin.id) : '',
    client_description: reservation.client_description || ''
  };
}

function IconCalendar(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
      <path d="M8 2.5v4" />
      <path d="M16 2.5v4" />
      <path d="M3.5 9.5h17" />
    </svg>
  );
}

function IconPlus(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function IconEye(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconPencil(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 20h4l10.5-10.5a2.828 2.828 0 0 0-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  );
}

function IconTrash(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M9 7V4h6v3" />
    </svg>
  );
}

function IconClock(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function IconChevronLeft(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function IconChevronRight(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function ActionIconButton({ icon: Icon, label, onClick, tone = 'default', active = false }) {
  const toneClasses =
    tone === 'danger'
      ? 'text-red-500 hover:bg-red-50 hover:text-red-600'
      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900';
  const activeClasses = active
    ? 'bg-gray-100 text-gray-900'
    : 'bg-transparent';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition ${toneClasses} ${activeClasses} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function buildStatusOptions(currentStatus) {
  const options = [...STATUS_OPTIONS];
  if (currentStatus && !options.some((option) => option.value === currentStatus)) {
    options.push({ value: currentStatus, label: formatStatusLabel(currentStatus) });
  }
  return options;
}

export default function AdminCalendar() {
  const {
    state: { reservations, reservationsPagination, admins, schedule, loading, users, reservationsLoading },
    actions: {
      setFeedback,
      createReservation,
      updateReservation,
      deleteReservation,
      updateSchedule,
      createClosure,
      updateClosure,
      deleteClosure,
      loadMoreReservations,
      refreshReservations,
      refreshUsers
    }
  } = useAdminDashboard();
  const navigate = useNavigate();

  const [reservationDrafts, setReservationDrafts] = useState({});
  const [newReservationDraft, setNewReservationDraft] = useState(NEW_APPOINTMENT_TEMPLATE);
  const [hoursDraft, setHoursDraft] = useState(normaliseOperatingHours(schedule.operating_hours));
  const [closureDateInput, setClosureDateInput] = useState('');
  const [closureReasonInput, setClosureReasonInput] = useState('');
  const [closureFormError, setClosureFormError] = useState('');
  const [editingClosureId, setEditingClosureId] = useState(null);
  const [editingClosureDate, setEditingClosureDate] = useState('');
  const [editingClosureReason, setEditingClosureReason] = useState('');
  const [editingClosureError, setEditingClosureError] = useState('');
  const [closureBusy, setClosureBusy] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingReservationId, setEditingReservationId] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [reservationSearchQuery, setReservationSearchQuery] = useState('');
  const [reservationSortOption, setReservationSortOption] = useState('schedule-asc');
  const [viewMode, setViewMode] = useState('month');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showClientSearchResults, setShowClientSearchResults] = useState(false);
  const [focusDate, setFocusDate] = useState(() => new Date());
  const [dayModalDate, setDayModalDate] = useState(null);
  const [selectedReservationId, setSelectedReservationId] = useState(null);
  const initialReservationsLoadRef = useRef(false);

  useEffect(() => {
    const drafts = {};
    reservations.forEach((reservation) => {
      drafts[reservation.id] = buildDraftFromReservation(reservation);
    });
    setReservationDrafts(drafts);
  }, [reservations]);

  useEffect(() => {
    setHoursDraft(normaliseOperatingHours(schedule.operating_hours));
  }, [schedule.operating_hours]);

  useEffect(() => {
    if (showCreateForm && !users.length) {
      refreshUsers().catch(() => { });
    }
  }, [showCreateForm, users.length, refreshUsers]);

  useEffect(() => {
    if (initialReservationsLoadRef.current) {
      return;
    }
    if (reservations.length) {
      initialReservationsLoadRef.current = true;
      return;
    }
    if (loading || reservationsLoading) {
      return;
    }
    initialReservationsLoadRef.current = true;
    refreshReservations().catch(() => { });
  }, [reservations.length, loading, reservationsLoading, refreshReservations]);

  const closures = useMemo(() => ensureArray(schedule.closures), [schedule.closures]);
  const closureDaysSet = useMemo(() => new Set(ensureArray(schedule.days_off)), [schedule.days_off]);

  const adminOptions = useMemo(
    () => admins.map((admin) => ({ value: String(admin.id), label: admin.name })),
    [admins]
  );
  const clientDirectory = useMemo(() => ensureArray(users), [users]);
  const selectedClient = useMemo(() => {
    const id = Number(newReservationDraft.client_id);
    if (!id) {
      return null;
    }
    return clientDirectory.find((client) => client.id === id) || null;
  }, [clientDirectory, newReservationDraft.client_id]);
  const filteredClients = useMemo(() => {
    const query = clientSearchQuery.trim().toLowerCase();
    const orderedDirectory = clientDirectory.slice().sort((a, b) => {
      const aName = a?.display_name || a?.email || '';
      const bName = b?.display_name || b?.email || '';
      return aName.localeCompare(bName);
    });
    if (!query) {
      return orderedDirectory.slice(0, 8);
    }
    return orderedDirectory
      .filter((client) => {
        const haystack = `${client?.display_name ?? ''} ${client?.email ?? ''} ${client?.phone ?? ''}`.toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 8);
  }, [clientDirectory, clientSearchQuery]);
  const isLoadingReservations = !reservations.length && (loading || reservationsLoading);

  const filteredReservations = useMemo(() => {
    const query = reservationSearchQuery.trim().toLowerCase();
    const scheduleTime = (reservation) =>
      reservation.scheduled_start ? new Date(reservation.scheduled_start).getTime() : null;
    const createdTime = (reservation) => (reservation.created_at ? new Date(reservation.created_at).getTime() : 0);
    const matchesQuery = (reservation) => {
      if (!query) {
        return true;
      }
      const fields = [
        reservation.client?.display_name,
        reservation.guest_name,
        reservation.guest_email,
        reservation.guest_phone,
        reservation.reference_code,
        reservation.status,
        reservation.assigned_admin?.name,
        reservation.assigned_admin?.display_name,
        reservation.assigned_admin?.email
      ]
        .filter(Boolean)
        .map((value) => value.toString().toLowerCase());
      return fields.some((field) => field.includes(query));
    };
    const compareScheduleAsc = (a, b) => {
      const aTime = scheduleTime(a);
      const bTime = scheduleTime(b);
      if (aTime === null && bTime === null) {
        return createdTime(b) - createdTime(a);
      }
      if (aTime === null) {
        return 1;
      }
      if (bTime === null) {
        return -1;
      }
      if (aTime === bTime) {
        return createdTime(b) - createdTime(a);
      }
      return aTime - bTime;
    };
    const compareScheduleDesc = (a, b) => {
      const aTime = scheduleTime(a);
      const bTime = scheduleTime(b);
      if (aTime === null && bTime === null) {
        return createdTime(b) - createdTime(a);
      }
      if (aTime === null) {
        return 1;
      }
      if (bTime === null) {
        return -1;
      }
      if (aTime === bTime) {
        return createdTime(b) - createdTime(a);
      }
      return bTime - aTime;
    };
    const compareStatusAsc = (a, b) => {
      const result = (a.status || 'pending').localeCompare(b.status || 'pending');
      if (result !== 0) {
        return result;
      }
      return compareScheduleAsc(a, b);
    };
    const compareStatusDesc = (a, b) => {
      const result = (b.status || 'pending').localeCompare(a.status || 'pending');
      if (result !== 0) {
        return result;
      }
      return compareScheduleAsc(a, b);
    };
    const comparator =
      {
        'schedule-asc': compareScheduleAsc,
        'schedule-desc': compareScheduleDesc,
        'status-asc': compareStatusAsc,
        'status-desc': compareStatusDesc
      }[reservationSortOption] || compareScheduleAsc;

    return reservations.filter(matchesQuery).slice().sort(comparator);
  }, [reservationSearchQuery, reservationSortOption, reservations]);

  const hasSearchQuery = Boolean(reservationSearchQuery.trim());
  const totalReservations = reservationsPagination.total || reservations.length;
  const todayKey = useMemo(() => formatNycDateKey(new Date()), []);

  const reservationsByDate = useMemo(() => {
    const map = new Map();
    filteredReservations.forEach((reservation) => {
      const dateKey = formatNycDateKey(reservation.scheduled_start);
      if (!dateKey) return;

      const bucket = map.get(dateKey) || [];
      bucket.push(reservation);
      map.set(dateKey, bucket);
    });
    map.forEach((bucket) => {
      bucket.sort((a, b) => {
        const aTime = a.scheduled_start ? new Date(a.scheduled_start).getTime() : 0;
        const bTime = b.scheduled_start ? new Date(b.scheduled_start).getTime() : 0;
        return aTime - bTime;
      });
    });
    return map;
  }, [filteredReservations]);

  const weekStart = useMemo(() => startOfWeekNyc(focusDate), [focusDate]);
  const weekDays = useMemo(() => {
    if (!weekStart) return [];
    return Array.from({ length: 7 }).map((_, index) => addDays(weekStart, index));
  }, [weekStart]);

  const monthDays = useMemo(() => getMonthGridDaysNyc(focusDate), [focusDate]);

  const calendarHeadline = useMemo(() => {
    if (viewMode === 'month') {
      return formatInTimeZone(focusDate, TIMEZONE, 'MMMM yyyy');
    }
    if (viewMode === 'week' && weekStart) {
      const weekEnd = addDays(weekStart, 6);
      const startLabel = formatInTimeZone(weekStart, TIMEZONE, 'MMM d');
      const endLabel = formatInTimeZone(weekEnd, TIMEZONE, 'MMM d');
      return `Week of ${startLabel} – ${endLabel}`;
    }
    return formatInTimeZone(focusDate, TIMEZONE, 'EEEE, MMM d');
  }, [focusDate, viewMode, weekStart]);

  const handleReservationDraftChange = (reservationId, field, value) => {
    setReservationDrafts((prev) => ({
      ...prev,
      [reservationId]: {
        ...prev[reservationId],
        [field]: value
      }
    }));
  };

  const handleCreateDraftChange = (field, value) => {
    setNewReservationDraft((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleClientSearchChange = (value) => {
    setClientSearchQuery(value);
    if (newReservationDraft.client_id) {
      handleCreateDraftChange('client_id', '');
    }
    setShowClientSearchResults(true);
  };

  const handleClientSelect = (client) => {
    if (!client?.id) {
      return;
    }
    setNewReservationDraft((prev) => ({
      ...prev,
      client_id: String(client.id),
      guest_name: client.display_name || '',
      guest_email: client.email || '',
      guest_phone: client.phone || ''
    }));
    setClientSearchQuery(client.display_name || client.email || `Client #${client.id}`);
    setShowClientSearchResults(false);
  };

  const handleClientClear = () => {
    setNewReservationDraft((prev) => ({
      ...prev,
      client_id: '',
      guest_name: '',
      guest_email: '',
      guest_phone: ''
    }));
    setClientSearchQuery('');
    setShowClientSearchResults(false);
  };

  const handleHoursDraftChange = (day, field, value) => {
    setHoursDraft((prev) =>
      prev.map((entry) => {
        if (entry.day !== day) {
          return entry;
        }
        if (field === 'is_open') {
          return { ...entry, is_open: value };
        }
        return { ...entry, [field]: value };
      })
    );
  };

  const requestReservationUpdate = (reservationId) => {
    const draft = reservationDrafts[reservationId];
    if (!draft) {
      return;
    }
    const reservation = reservations.find((entry) => entry.id === reservationId);
    if (!reservation) {
      setFeedback({ tone: 'offline', message: 'Reservation not found.' });
      return;
    }
    const normalizedStart = alignScheduledStartInput(draft.scheduled_start);
    const normalizedDuration = alignDurationInput(draft.duration_minutes);
    const normalizedDraft = {
      ...draft,
      scheduled_start: normalizedStart,
      duration_minutes: normalizedDuration
    };
    if (normalizedStart !== draft.scheduled_start || normalizedDuration !== draft.duration_minutes) {
      setReservationDrafts((prev) => ({
        ...prev,
        [reservationId]: normalizedDraft
      }));
    }
    const payload = buildReservationUpdatePayload(reservation, normalizedDraft);
    if (!payload || !Object.keys(payload).length) {
      setFeedback({ tone: 'offline', message: 'No changes to save.' });
      return;
    }
    setConfirmation({
      type: 'update',
      reservationId,
      payload,
      title: 'Update reservation',
      description: `Apply scheduling changes to reservation #${reservationId}?`
    });
  };

  const requestReservationDelete = (reservation) => {
    setConfirmation({
      type: 'delete',
      reservationId: reservation.id,
      title: 'Delete reservation',
      description: `This will remove reservation ${reservation.reference_code || `#${reservation.id}`}.`
    });
  };

  const requestReservationCreate = () => {
    const normalizedStart = alignScheduledStartInput(newReservationDraft.scheduled_start);
    const normalizedDuration = alignDurationInput(newReservationDraft.duration_minutes);
    const normalizedDraft = {
      ...newReservationDraft,
      scheduled_start: normalizedStart,
      duration_minutes: normalizedDuration
    };
    if (normalizedStart !== newReservationDraft.scheduled_start || normalizedDuration !== newReservationDraft.duration_minutes) {
      setNewReservationDraft(normalizedDraft);
    }
    const payload = buildReservationCreatePayload(normalizedDraft);
    if (!payload.client_id && (!payload.guest_name || !payload.guest_email)) {
      setFeedback({ tone: 'offline', message: 'Select a client or provide guest name and email.' });
      return;
    }
    setConfirmation({
      type: 'create',
      payload,
      title: 'Create reservation',
      description: 'Add this reservation to the calendar?'
    });
  };

  const requestScheduleUpdate = () => {
    const normalizedOperatingHours = hoursDraft.map((entry) => {
      return {
        day: entry.day,
        is_open: entry.is_open,
        open_time: entry.open_time,
        close_time: entry.close_time
      };
    });

    setConfirmation({
      type: 'schedule',
      payload: {
        operating_hours: normalizedOperatingHours,
        days_off: ensureArray(schedule.days_off)
      },
      title: 'Update hours',
      description: 'Save these operating hours and days off?'
    });
  };

  const handleAddClosure = async () => {
    if (!closureDateInput) {
      setClosureFormError('Pick a date for this closure.');
      return;
    }
    setClosureFormError('');
    setClosureBusy(true);
    try {
      await createClosure({
        date: closureDateInput,
        reason: closureReasonInput.trim() || undefined
      });
      setClosureDateInput('');
      setClosureReasonInput('');
    } catch (error) {
      setClosureFormError(error?.message || 'Unable to save closure.');
    } finally {
      setClosureBusy(false);
    }
  };

  const handleStartEditClosure = (closure) => {
    setEditingClosureId(closure.id);
    setEditingClosureDate(closure.date);
    setEditingClosureReason(closure.reason || '');
    setEditingClosureError('');
  };

  const handleCancelEditClosure = () => {
    setEditingClosureId(null);
    setEditingClosureDate('');
    setEditingClosureReason('');
    setEditingClosureError('');
  };

  const handleSaveClosureEdit = async () => {
    if (!editingClosureId) {
      return;
    }
    if (!editingClosureDate) {
      setEditingClosureError('Date is required.');
      return;
    }
    setEditingClosureError('');
    setClosureBusy(true);
    try {
      await updateClosure(editingClosureId, {
        date: editingClosureDate,
        reason: editingClosureReason.trim() || null
      });
      handleCancelEditClosure();
    } catch (error) {
      setEditingClosureError(error?.message || 'Unable to update closure.');
    } finally {
      setClosureBusy(false);
    }
  };

  const requestClosureDelete = (closure) => {
    setConfirmation({
      type: 'closureDelete',
      closureId: closure.id,
      closureDate: closure.date,
      title: 'Remove scheduled closure',
      description: `Remove the closure on ${formatClosureDate(closure.date)}?`
    });
  };

  const handleConfirm = async () => {
    if (!confirmation) {
      return;
    }
    const activeConfirmation = confirmation;
    const editingTargetId = editingReservationId;
    const shouldCloseEditor =
      (activeConfirmation.type === 'update' || activeConfirmation.type === 'delete') &&
      editingTargetId === activeConfirmation.reservationId;
    setConfirmBusy(true);
    setConfirmation(null);
    if (shouldCloseEditor) {
      setEditingReservationId(null);
    }
    try {
      if (activeConfirmation.type === 'create') {
        await createReservation(activeConfirmation.payload);
        setNewReservationDraft(NEW_APPOINTMENT_TEMPLATE);
        setClientSearchQuery('');
        setShowClientSearchResults(false);
      } else if (activeConfirmation.type === 'update') {
        await updateReservation(activeConfirmation.reservationId, activeConfirmation.payload);
      } else if (activeConfirmation.type === 'delete') {
        await deleteReservation(activeConfirmation.reservationId);
      } else if (activeConfirmation.type === 'closureDelete') {
        await deleteClosure(activeConfirmation.closureId);
        handleCancelEditClosure();
      } else if (activeConfirmation.type === 'schedule') {
        await updateSchedule(activeConfirmation.payload);
      }
    } catch (err) {
        setFeedback({
        tone: 'offline',
        message:
          activeConfirmation.type === 'create'
            ? 'Unable to create reservation.'
            : activeConfirmation.type === 'update'
              ? 'Unable to update reservation.'
              : activeConfirmation.type === 'delete'
                ? 'Unable to delete reservation.'
                : activeConfirmation.type === 'closureDelete'
                  ? 'Unable to remove closure.'
                  : 'Unable to update hours.'
      });
      if (shouldCloseEditor && activeConfirmation.type === 'update') {
        const latestReservation = reservations.find((entry) => entry.id === activeConfirmation.reservationId);
        if (latestReservation) {
          resetReservationDraft(latestReservation);
        }
        setEditingReservationId(activeConfirmation.reservationId);
      }
    } finally {
      setConfirmBusy(false);
    }
  };


  const resetReservationDraft = (reservation) => {
    setReservationDrafts((prev) => ({
      ...prev,
      [reservation.id]: buildDraftFromReservation(reservation)
    }));
  };

  const handleEditClick = (reservation) => {
    if (editingReservationId === reservation.id) {
      resetReservationDraft(reservation);
      setEditingReservationId(null);
      return;
    }
    if (editingReservationId !== null && editingReservationId !== reservation.id) {
      const previous = reservations.find((entry) => entry.id === editingReservationId);
      if (previous) {
        resetReservationDraft(previous);
      }
    }
    setEditingReservationId(reservation.id);
  };

  const handleCancelEdit = (reservation) => {
    resetReservationDraft(reservation);
    setEditingReservationId(null);
  };

  const renderEmptyState = (message) => (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-600">
      <IconCalendar className="h-8 w-8 text-gray-400" />
      <p>{message}</p>
    </div>
  );

  const renderLoadingState = (message = 'Loading reservations...') => (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-600">
      <svg className="h-6 w-6 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <p>{message}</p>
    </div>
  );

  const handleCreateSubmit = (event) => {
    event.preventDefault();
    requestReservationCreate();
  };

  // Prevent any global/app-level key handlers (ex: calendar navigation shortcuts)
  // from triggering while the user is typing in an input.
  const stopGlobalHotkeysWhenTyping = (event) => {
    event.stopPropagation();
  };

  const handleChangeFocus = (direction) => {
    setFocusDate((prev) => {
      const next = new Date(prev);
      if (viewMode === 'day') {
        next.setDate(prev.getDate() + direction);
      } else if (viewMode === 'week') {
        next.setDate(prev.getDate() + direction * 7);
      } else {
        next.setMonth(prev.getMonth() + direction);
      }
      return next;
    });
  };

  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    if (mode !== 'day') {
      setDayModalDate(null);
    }
  };

  const openDayModal = (date) => {
    const nextDate = new Date(date);
    if (Number.isNaN(nextDate.getTime())) {
      return;
    }
    setFocusDate(nextDate);
    setDayModalDate(nextDate);
  };

  const closeDayModal = () => {
    setDayModalDate(null);
  };

  const handleDayModalChange = (direction) => {
    setDayModalDate((prev) => {
      const base = prev || focusDate || new Date();
      const next = new Date(base);
      next.setDate(base.getDate() + direction);
      setFocusDate(next);
      return next;
    });
  };

  const setFocusDay = (date) => {
    const nextDate = new Date(date);
    if (Number.isNaN(nextDate.getTime())) {
      return;
    }
    setFocusDate(nextDate);
    setDayModalDate(null);
  };

  const renderReservationBadge = (reservation) => {
    const clientName = reservation.client?.display_name || reservation.guest_name || 'Guest client';
    const timeRange = formatReservationTimeRange(reservation);
    const status = reservation.status || 'pending';
    const statusClasses = getStatusBadgeClasses(status);
    const statusLabel = formatStatusLabel(status) || 'Pending';
    const reference = reservation.reference_code || `#${reservation.id}`;
    return (
      <button
        type="button"
        onClick={() => setSelectedReservationId(reservation.id)}
        key={reservation.id}
        className="w-full space-y-2 rounded-2xl border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:border-gray-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900">{timeRange}</p>
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ring-1 ring-inset ${statusClasses}`}
          >
            {statusLabel}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span className="font-medium">{clientName}</span>
          <span className="text-gray-500">{reference}</span>
        </div>
      </button>
    );
  };

  const renderDayContent = (date) => {
    if (isLoadingReservations) {
      return renderLoadingState();
    }

    const dayKey = formatNycDateKey(date);
    const dayReservations = dayKey ? reservationsByDate.get(dayKey) || [] : [];

    if (!dayReservations.length) {
      return renderEmptyState('No reservations scheduled for this day.');
    }

    return <div className="grid gap-3">{dayReservations.map((reservation) => renderReservationBadge(reservation))}</div>;
  };

  const renderDayView = () => renderDayContent(focusDate);

  const renderWeekView = () => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {weekDays.map((day) => {
        const dateKey = formatNycDateKey(day);
        const entries = dateKey ? reservationsByDate.get(dateKey) || [] : [];
        const isToday = todayKey === dateKey;
        return (
          <div
            key={dateKey || day.toISOString()}
            className={`space-y-2 rounded-2xl border bg-white p-3 shadow-sm ${isToday
              ? 'border-gray-900 ring-2 ring-gray-900/10'
              : 'border-gray-200'
              }`}
          >
            <button
              type="button"
              onClick={() => openDayModal(day)}
              className="flex w-full items-center justify-between text-sm font-semibold text-gray-900 transition hover:text-gray-600"
            >
              <span>{day.toLocaleDateString([], { weekday: 'short' })}</span>
              <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
                {day.getDate()}
              </span>
            </button>
            {entries.length ? (
              <div className="space-y-2">
                {entries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setSelectedReservationId(entry.id)}
                    className="w-full rounded-xl bg-gray-50 p-2 text-left text-xs transition hover:border hover:border-gray-200 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                  >
                    <p className="font-semibold text-gray-900">{formatReservationTimeRange(entry)}</p>
                    <p className="text-gray-600">{entry.client?.display_name || entry.guest_name}</p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                {isLoadingReservations ? 'Loading reservations...' : 'No reservations'}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderMonthView = () => {
    const activeMonth = focusDate.getMonth();
    const selectedDateKey = formatNycDateKey(focusDate);
    const selectedEntries = selectedDateKey ? reservationsByDate.get(selectedDateKey) || [] : [];
    const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <section className="space-y-4 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gray-500">
                Schedule for
              </p>
              <p className="text-base font-semibold text-gray-900">
                {formatInTimeZone(focusDate, TIMEZONE, 'EEEE, MMMM d, yyyy')}
              </p>
            </div>
            <Button type="button" variant="ghost" onClick={() => openDayModal(focusDate)}>
              Open day
            </Button>
          </div>
          <ol className="space-y-2 text-sm text-gray-600">
            {selectedEntries.length ? (
              selectedEntries.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedReservationId(entry.id)}
                    className="group flex w-full items-center gap-3 rounded-2xl border border-gray-200 px-3 py-2 text-left transition hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                  >
                    <div className="flex-1">
                      <p className="text-gray-900">
                        {entry.client?.display_name || entry.guest_name || 'Guest client'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{formatReservationTimeRange(entry)}</span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] ring-1 ring-inset ${getStatusBadgeClasses(
                            entry.status
                          )}`}
                        >
                          {formatStatusLabel(entry.status) || 'Pending'}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              ))
            ) : (
              <li className="rounded-2xl border border-dashed border-gray-300 px-3 py-4 text-xs text-gray-500">
                {isLoadingReservations ? 'Loading reservations...' : 'No reservations scheduled.'}
              </li>
            )}
          </ol>
        </section>

        <section className="space-y-4 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 lg:max-w-md lg:justify-self-end">
          <div className="flex items-center justify-between text-sm font-semibold text-gray-900">
            <span>{formatInTimeZone(focusDate, TIMEZONE, 'MMMM yyyy')}</span>
          </div>
          <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">
            {weekdayLabels.map((label) => (
              <span key={`mini-${label}`}>{label}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {monthDays.map((day, index) => {
              const dateKey = formatNycDateKey(day);
              const entries = dateKey ? reservationsByDate.get(dateKey) || [] : [];
              const isCurrentMonth = day.getMonth() === activeMonth;
              const isToday = dateKey === todayKey;
              const isSelected = dateKey === selectedDateKey;
              return (
                <button
                  key={dateKey || `mini-${index}`}
                  type="button"
                  onClick={() => setFocusDay(day)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-semibold transition ${isSelected
                    ? 'bg-gray-900 text-white shadow-sm'
                    : isToday
                      ? 'border border-gray-900 text-gray-900'
                      : isCurrentMonth
                        ? 'text-gray-700 hover:bg-gray-100'
                        : 'text-gray-400'
                    }`}
                  aria-label={`View ${formatInTimeZone(day, TIMEZONE, 'MMMM d')}`}
                >
                  <span className="relative flex h-full w-full items-center justify-center">
                    {day.getDate()}
                    {entries.length ? (
                      <span className="absolute -bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-gray-900" />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    );
  };

  const renderDayModal = () => {
    if (!dayModalDate) {
      return null;
    }
    const modalDateLabel = formatInTimeZone(dayModalDate, TIMEZONE, 'EEEE, MMMM d, yyyy');
    const isToday = formatNycDateKey(dayModalDate) === todayKey;

    return (
      <Dialog open={Boolean(dayModalDate)} onClose={closeDayModal} title="Day schedule">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gray-500">Selected day</p>
            <p className="text-base font-semibold text-gray-900">{modalDateLabel}</p>
            {isToday ? <p className="text-xs text-gray-500">Today</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <ActionIconButton icon={IconChevronLeft} label="Previous day" onClick={() => handleDayModalChange(-1)} />
            <ActionIconButton icon={IconChevronRight} label="Next day" onClick={() => handleDayModalChange(1)} />
            <Button type="button" variant="ghost" onClick={() => openDayModal(new Date())}>
              Today
            </Button>
          </div>
        </div>
        {renderDayContent(dayModalDate)}
      </Dialog>
    );
  };

  const selectedReservation = useMemo(
    () => reservations.find((reservation) => reservation.id === selectedReservationId) || null,
    [reservations, selectedReservationId]
  );

  const closeReservationModal = () => setSelectedReservationId(null);

  const renderReservationModal = () => {
    if (!selectedReservation) {
      return null;
    }

    const scheduledDate = selectedReservation.scheduled_start
      ? new Date(selectedReservation.scheduled_start)
      : null;
    const scheduledLabel = scheduledDate
      ? formatInTimeZone(scheduledDate, TIMEZONE, 'PPP p')
      : 'Awaiting schedule';
    const durationLabel = selectedReservation.duration_minutes
      ? `${selectedReservation.duration_minutes} minutes`
      : 'Not set';
    const assigned =
      selectedReservation.assigned_admin?.name ||
      selectedReservation.assigned_admin?.display_name ||
      selectedReservation.assigned_admin?.email ||
      'Unassigned';
    const contact =
      selectedReservation.client?.email ||
      selectedReservation.guest_email ||
      selectedReservation.guest_phone ||
      'No contact info';
    const clientName = selectedReservation.client?.display_name || selectedReservation.guest_name || 'Guest client';
    const reference = selectedReservation.reference_code || `#${selectedReservation.id}`;

    return (
      <Dialog open={Boolean(selectedReservation)} onClose={closeReservationModal} title="Reservation details">
        <div className="space-y-2 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-900">{clientName}</p>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Ref {reference}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 rounded-2xl border border-gray-200 p-3 text-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Schedule</p>
            <p className="font-semibold text-gray-900">{scheduledLabel}</p>
            <p className="text-xs text-gray-500">Duration: {durationLabel}</p>
          </div>
          <div className="space-y-1 rounded-2xl border border-gray-200 p-3 text-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Status</p>
            <span
              className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ring-1 ring-inset ${getStatusBadgeClasses(
                selectedReservation.status
              )}`}
            >
              {formatStatusLabel(selectedReservation.status) || 'Pending'}
            </span>
            <p className="text-xs text-gray-500">Assigned: {assigned}</p>
          </div>
          <div className="space-y-1 rounded-2xl border border-gray-200 p-3 text-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Contact</p>
            <p className="font-semibold text-gray-900">{contact}</p>
          </div>
          <div className="space-y-1 rounded-2xl border border-gray-200 p-3 text-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Type</p>
            <p className="font-semibold text-gray-900">{getReservationTypeLabel(selectedReservation)}</p>
          </div>
          <div className="space-y-1 rounded-2xl border border-gray-200 p-3 text-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Notes</p>
            <p className="text-sm text-gray-700">
              {selectedReservation.client_description || 'No notes yet.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="ghost" onClick={closeReservationModal}>
            Close
          </Button>
          <Button type="button" onClick={() => navigate(`${selectedReservation.id}`)}>
            View full details
          </Button>
        </div>
      </Dialog>
    );
  };

  const renderCreatePanel = () => (
    <form className="space-y-6" onSubmit={handleCreateSubmit}>
      <div className="flex items-center gap-3 text-gray-700">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-white">
          <IconPlus className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em]">Create reservation</p>
          <p className="text-xs text-gray-500">Schedule time for a client or guest.</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label
            htmlFor={NEW_APPOINTMENT_FIELD_IDS.clientId}
            className="text-xs uppercase tracking-[0.3em] text-gray-500"
          >
            Client
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm">🔍</span>
            <input
              id={NEW_APPOINTMENT_FIELD_IDS.clientId}
              type="search"
              value={clientSearchQuery}
              onFocus={() => setShowClientSearchResults(true)}
              onBlur={() => {
                setTimeout(() => setShowClientSearchResults(false), 120);
              }}
              onChange={(event) => handleClientSearchChange(event.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-white py-2 pl-9 pr-24 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
              placeholder="Search by name, phone, or email"
              autoComplete="off"
              onKeyDown={stopGlobalHotkeysWhenTyping}
              onKeyUp={stopGlobalHotkeysWhenTyping}
              onKeyDownCapture={stopGlobalHotkeysWhenTyping}
            />
            {newReservationDraft.client_id ? (
              <button
                type="button"
                onClick={handleClientClear}
                className="absolute inset-y-1 right-1 rounded-xl px-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-600 transition hover:bg-gray-100"
              >
                Clear
              </button>
            ) : null}
            {showClientSearchResults ? (
              <div className="absolute z-10 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-lg">
                {filteredClients.length ? (
                  filteredClients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handleClientSelect(client);
                      }}
                      className="block w-full space-y-1 px-3 py-2 text-left transition hover:bg-gray-100 focus:outline-none"
                    >
                      <p className="text-sm font-semibold text-gray-900">
                        {client.display_name || 'Unnamed client'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {[client.email, client.phone].filter(Boolean).join(' · ') || 'No contact info'}
                      </p>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-gray-500">No clients match that search.</p>
                )}
              </div>
            ) : null}
          </div>
          <p className="text-xs text-gray-500">
            {selectedClient
              ? `Selected ${selectedClient.display_name || 'client'} (#${selectedClient.id}).`
              : 'Select an existing client or leave blank for a guest booking.'}
          </p>
        </div>
        <div className="space-y-2">
          <label
            htmlFor={NEW_APPOINTMENT_FIELD_IDS.status}
            className="text-xs uppercase tracking-[0.3em] text-gray-500"
          >
            Status
          </label>
          <select
            id={NEW_APPOINTMENT_FIELD_IDS.status}
            value={newReservationDraft.status}
            onChange={(event) => handleCreateDraftChange('status', event.target.value)}
            className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label
            htmlFor={NEW_APPOINTMENT_FIELD_IDS.guestName}
            className="text-xs uppercase tracking-[0.3em] text-gray-500"
          >
            Guest name
          </label>
          <input
            id={NEW_APPOINTMENT_FIELD_IDS.guestName}
            type="text"
            value={newReservationDraft.guest_name}
            onChange={(event) => handleCreateDraftChange('guest_name', event.target.value)}
            className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
            placeholder="Required if no client ID"
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor={NEW_APPOINTMENT_FIELD_IDS.guestEmail}
            className="text-xs uppercase tracking-[0.3em] text-gray-500"
          >
            Guest email
          </label>
          <input
            id={NEW_APPOINTMENT_FIELD_IDS.guestEmail}
            type="email"
            value={newReservationDraft.guest_email}
            onChange={(event) => handleCreateDraftChange('guest_email', event.target.value)}
            className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
            placeholder="Required if no client ID"
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor={NEW_APPOINTMENT_FIELD_IDS.scheduledStart}
            className="text-xs uppercase tracking-[0.3em] text-gray-500"
          >
            Start
          </label>
          <input
            id={NEW_APPOINTMENT_FIELD_IDS.scheduledStart}
            type="datetime-local"
            step="3600"
            value={newReservationDraft.scheduled_start}
            onChange={(event) => handleCreateDraftChange('scheduled_start', event.target.value)}
            className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor={NEW_APPOINTMENT_FIELD_IDS.duration}
            className="text-xs uppercase tracking-[0.3em] text-gray-500"
          >
            Duration (min)
          </label>
          <input
            id={NEW_APPOINTMENT_FIELD_IDS.duration}
            type="number"
            min="60"
            step="60"
            value={newReservationDraft.duration_minutes}
            onChange={(event) => handleCreateDraftChange('duration_minutes', event.target.value)}
            className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor={NEW_APPOINTMENT_FIELD_IDS.assignedAdmin}
            className="text-xs uppercase tracking-[0.3em] text-gray-500"
          >
            Assign admin
          </label>
          <select
            id={NEW_APPOINTMENT_FIELD_IDS.assignedAdmin}
            value={newReservationDraft.assigned_admin_id}
            onChange={(event) => handleCreateDraftChange('assigned_admin_id', event.target.value)}
            className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
          >
            <option value="">Unassigned</option>
            {adminOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label
            htmlFor={NEW_APPOINTMENT_FIELD_IDS.guestPhone}
            className="text-xs uppercase tracking-[0.3em] text-gray-500"
          >
            Guest phone
          </label>
          <input
            id={NEW_APPOINTMENT_FIELD_IDS.guestPhone}
            type="tel"
            value={newReservationDraft.guest_phone}
            onChange={(event) => handleCreateDraftChange('guest_phone', event.target.value)}
            className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
          />
        </div>
      </div>
      <div className="space-y-2">
        <label
          htmlFor={NEW_APPOINTMENT_FIELD_IDS.description}
          className="text-xs uppercase tracking-[0.3em] text-gray-500"
        >
          Notes
        </label>
        <textarea
          id={NEW_APPOINTMENT_FIELD_IDS.description}
          rows={3}
          value={newReservationDraft.client_description}
          onChange={(event) => handleCreateDraftChange('client_description', event.target.value)}
          placeholder="Client or session notes (optional)"
          className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500">A confirmation dialog appears before saving.</p>
        <Button type="submit">
          <IconPlus className="h-4 w-4" />
          Add to calendar
        </Button>
      </div>
    </form>
  );

  const renderReservationList = () => {
    const showingTotal = totalReservations || filteredReservations.length;
    const showingLabel = hasSearchQuery
      ? `Showing ${filteredReservations.length} of ${showingTotal} reservations`
      : `Showing ${filteredReservations.length} reservations`;

    if (isLoadingReservations) {
      return renderLoadingState();
    }

    const hasFilteredReservations = filteredReservations.length > 0;
    const emptyMessage = hasSearchQuery ? 'No reservations match your search.' : 'No reservations scheduled yet.';

    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full min-w-[240px] lg:w-72">
            <label htmlFor="admin-calendar-search" className="sr-only">
              Search reservations
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm">🔍</span>
              <input
                id="admin-calendar-search"
                type="search"
                value={reservationSearchQuery}
                onChange={(event) => setReservationSearchQuery(event.target.value)}
                placeholder="Search by client, contact, reference, or status"
                className="w-full rounded-2xl border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-0"
                onKeyDown={stopGlobalHotkeysWhenTyping}
                onKeyUp={stopGlobalHotkeysWhenTyping}
                onKeyDownCapture={stopGlobalHotkeysWhenTyping}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            <label
              htmlFor="admin-calendar-sort"
              className="text-xs uppercase tracking-[0.3em] text-gray-500"
            >
              Sort
            </label>
            <select
              id="admin-calendar-sort"
              value={reservationSortOption}
              onChange={(event) => setReservationSortOption(event.target.value)}
              className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
            >
              <option value="schedule-asc">Upcoming (chronological)</option>
              <option value="schedule-desc">Latest first</option>
              <option value="status-asc">Status A → Z</option>
              <option value="status-desc">Status Z → A</option>
            </select>
          </div>
        </div>

        {hasFilteredReservations && (
          <p className="text-xs text-gray-500">{showingLabel}</p>
        )}

        {hasFilteredReservations ? (
          <>
            <div className="flow-root">
              <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                  <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
                    <div className="max-h-[720px] overflow-y-auto">
                      <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50">
                          <tr>
                            <th
                              scope="col"
                              className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
                            >
                              Client
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                            >
                              Schedule
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                            >
                              Status
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                            >
                              Assigned
                            </th>
                            <th
                              scope="col"
                              className="py-3.5 pl-3 pr-4 text-right text-sm font-semibold text-gray-900 sm:pr-6"
                            >
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {filteredReservations.map((reservation) => {
                            const draft = reservationDrafts[reservation.id] || buildDraftFromReservation(reservation);
                            const scheduledDate = reservation.scheduled_start ? new Date(reservation.scheduled_start) : null;
                            const formattedDate = scheduledDate
                              ? scheduledDate.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
                              : 'Awaiting schedule';
                            const clientName = reservation.client?.display_name || reservation.guest_name || 'Guest client';
                            const contact =
                              reservation.client?.email || reservation.guest_email || reservation.guest_phone || 'No contact info';
                            const reference = reservation.reference_code || `#${reservation.id}`;
                            const assigned =
                              reservation.assigned_admin?.name ||
                              reservation.assigned_admin?.display_name ||
                              reservation.assigned_admin?.email ||
                              'Unassigned';
                            const scheduledDateKey = scheduledDate ? scheduledDate.toISOString().slice(0, 10) : null;
                            const isDayOff = scheduledDateKey ? closureDaysSet.has(scheduledDateKey) : false;
                            const baseId = `reservation-${reservation.id}`;
                            const statusId = `${baseId}-status`;
                            const startId = `${baseId}-start`;
                            const durationId = `${baseId}-duration`;
                            const adminId = `${baseId}-assigned-admin`;
                            const notesId = `${baseId}-notes`;
                            const isEditing = editingReservationId === reservation.id;
                            const statusOptions = buildStatusOptions(draft.status ?? reservation.status);
                            const statusLabel = formatStatusLabel(reservation.status) || 'Pending';

                            return [
                              <tr key={reservation.id} className="bg-white">
                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                                  <div className="flex items-center">
                                    <div className="mr-4 flex h-11 w-11 items-center justify-center rounded-full bg-gray-900 text-white">
                                      <IconCalendar className="h-5 w-5" />
                                    </div>
                                    <div>
                                      <div className="font-semibold text-gray-900">{clientName}</div>
                                      <div className="mt-1 text-xs text-gray-500">{contact}</div>
                                      <div className="mt-1 text-xs text-gray-500">Ref {reference}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                  <div className="text-gray-900">{formattedDate}</div>
                                  <div className="mt-1 text-xs text-gray-500">
                                    Duration {reservation.duration_minutes ? `${reservation.duration_minutes} min` : '—'}
                                  </div>
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                  <span
                                    className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-[0.2em] ring-1 ring-inset ${getStatusBadgeClasses(
                                      reservation.status
                                    )}`}
                                  >
                                    {statusLabel}
                                  </span>
                                  {isDayOff ? (
                                    <span className="ml-2 inline-flex items-center rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-600/20">
                                      Day off
                                    </span>
                                  ) : null}
                                </td>
                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                  <div className="text-gray-900">{assigned}</div>
                                </td>
                                <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      onClick={() => navigate(`${reservation.id}`)}
                                      aria-label={`View reservation ${reference} details`}
                                      className="px-3 py-2"
                                    >
                                      <IconEye className="h-4 w-4" />
                                      <span className="hidden text-xs uppercase tracking-[0.3em] sm:inline">Details</span>
                                    </Button>
                                    <ActionIconButton
                                      icon={IconPencil}
                                      label={isEditing ? 'Close editor' : 'Edit reservation'}
                                      onClick={() => handleEditClick(reservation)}
                                      active={isEditing}
                                    />
                                    <ActionIconButton
                                      icon={IconTrash}
                                      label={`Delete reservation ${reference}`}
                                      onClick={() => requestReservationDelete(reservation)}
                                      tone="danger"
                                    />
                                  </div>
                                </td>
                              </tr>,
                              isEditing ? (
                                <tr key={`${reservation.id}-edit`} className="bg-gray-50">
                                  <td colSpan={5} className="px-4 py-5 sm:px-6">
                                    <div className="space-y-4">
                                      <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                          <label
                                            htmlFor={statusId}
                                            className="text-xs uppercase tracking-[0.3em] text-gray-500"
                                          >
                                            Status
                                          </label>
                                          <select
                                            id={statusId}
                                            value={draft.status ?? ''}
                                            onChange={(event) =>
                                              handleReservationDraftChange(reservation.id, 'status', event.target.value)
                                            }
                                            className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
                                          >
                                            {statusOptions.map((option) => (
                                              <option key={option.value} value={option.value}>
                                                {option.label}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        <div className="space-y-2">
                                          <label
                                            htmlFor={startId}
                                            className="text-xs uppercase tracking-[0.3em] text-gray-500"
                                          >
                                            Start
                                          </label>
                                          <input
                                            id={startId}
                                            type="datetime-local"
                                            step="3600"
                                            value={draft.scheduled_start ?? ''}
                                            onChange={(event) =>
                                              handleReservationDraftChange(reservation.id, 'scheduled_start', event.target.value)
                                            }
                                            className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <label
                                            htmlFor={durationId}
                                            className="text-xs uppercase tracking-[0.3em] text-gray-500"
                                          >
                                            Duration (min)
                                          </label>
                                          <input
                                            id={durationId}
                                            type="number"
                                            min="60"
                                            step="60"
                                            value={draft.duration_minutes ?? ''}
                                            onChange={(event) =>
                                              handleReservationDraftChange(reservation.id, 'duration_minutes', event.target.value)
                                            }
                                            className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <label
                                            htmlFor={adminId}
                                            className="text-xs uppercase tracking-[0.3em] text-gray-500"
                                          >
                                            Assigned admin
                                          </label>
                                          <select
                                            id={adminId}
                                            value={draft.assigned_admin_id ?? ''}
                                            onChange={(event) =>
                                              handleReservationDraftChange(reservation.id, 'assigned_admin_id', event.target.value)
                                            }
                                            className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
                                          >
                                            <option value="">Unassigned</option>
                                            {adminOptions.map((option) => (
                                              <option key={option.value} value={option.value}>
                                                {option.label}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <label
                                          htmlFor={notesId}
                                          className="text-xs uppercase tracking-[0.3em] text-gray-500"
                                        >
                                          Notes
                                        </label>
                                        <textarea
                                          id={notesId}
                                          rows={3}
                                          value={draft.client_description ?? ''}
                                          onChange={(event) =>
                                            handleReservationDraftChange(reservation.id, 'client_description', event.target.value)
                                          }
                                          className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
                                        />
                                      </div>
                                      <div className="flex flex-wrap items-center justify-between gap-3">
                                        <p className="text-xs text-gray-500">
                                          Last update{' '}
                                          {reservation.updated_at
                                            ? new Date(reservation.updated_at).toLocaleString([], {
                                              dateStyle: 'medium',
                                              timeStyle: 'short'
                                            })
                                            : 'n/a'}
                                        </p>
                                        <div className="flex items-center gap-2">
                                          <Button type="button" onClick={() => requestReservationUpdate(reservation.id)}>
                                            <IconPencil className="h-4 w-4" />
                                            Save changes
                                          </Button>
                                          <Button type="button" variant="ghost" onClick={() => handleCancelEdit(reservation)}>
                                            Cancel
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              ) : null
                            ];
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {reservationsPagination.page < reservationsPagination.pages ? (
              <div className="mt-4 flex justify-center">
                <Button type="button" variant="ghost" onClick={() => loadMoreReservations()}>
                  Load more reservations
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          renderEmptyState(emptyMessage)
        )}
      </div>
    );
  };

  const reservationCountLabel =
    isLoadingReservations
      ? 'Loading reservations...'
      : totalReservations === 1
        ? '1 reservation scheduled'
        : `${totalReservations} reservations scheduled`;

  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="Admin"
        title="Calendar & hours"
        description="Manage reservations, operating hours, and closures in one place."
      />

      <Card className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-900 text-white">
              <IconCalendar className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">
                Calendar
              </p>
              <p className="text-sm text-gray-600">{reservationCountLabel}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => setShowCreateForm(true)}
              aria-expanded={showCreateForm}
              aria-controls="admin-calendar-create"
              variant="primary"
            >
              <IconPlus className="h-4 w-4" />
              New reservation
            </Button>
          </div>
        </div>
        {showCreateForm ? (
          <Dialog
            open={showCreateForm}
            onClose={() => setShowCreateForm(false)}
            title="New reservation"
            className="md:items-center"
          >
            <div className="space-y-4">
              {renderCreatePanel()}
              <div className="flex justify-end">
                <Button type="button" variant="ghost" onClick={() => setShowCreateForm(false)}>
                  Close
                </Button>
              </div>
            </div>
          </Dialog>
        ) : null}
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">
                View
              </p>
              <p className="text-sm text-gray-700">{calendarHeadline}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-full border border-gray-200 bg-gray-50 p-1 text-xs font-semibold uppercase tracking-[0.2em]">
                {['day', 'week', 'month'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleSetViewMode(mode)}
                    className={`rounded-full px-4 py-2 transition ${viewMode === mode
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                      }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <ActionIconButton icon={IconChevronLeft} label="Previous" onClick={() => handleChangeFocus(-1)} />
                <ActionIconButton icon={IconChevronRight} label="Next" onClick={() => handleChangeFocus(1)} />
                <Button type="button" variant="ghost" onClick={() => setFocusDate(new Date())}>
                  Today
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-4">
            {viewMode === 'day' ? renderDayView() : viewMode === 'week' ? renderWeekView() : renderMonthView()}
          </div>
        </div>
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          {renderReservationList()}
        </div>
      </Card>

      <Card className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-900 text-white">
              <IconClock className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">
                Operating hours
              </p>
              <p className="text-sm text-gray-600">Manage weekly hours and closures.</p>
            </div>
          </div>
          <Button type="button" onClick={requestScheduleUpdate}>
            <IconPencil className="h-4 w-4" />
            Save hours
          </Button>
        </div>
        <div className="grid gap-6">
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">
              Operating hours
            </h3>
            <div className="space-y-3">
              {hoursDraft.map((entry) => {
                const statusStyles = entry.is_open
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gray-200 text-gray-700';
                return (
                  <div
                    key={entry.day}
                    className="space-y-3 rounded-3xl border border-gray-200 bg-gray-50 p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <input
                          id={`hours-${entry.day}`}
                          type="checkbox"
                          checked={entry.is_open}
                          onChange={(event) => handleHoursDraftChange(entry.day, 'is_open', event.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                        />
                        <label
                          htmlFor={`hours-${entry.day}`}
                          className="text-sm font-semibold text-gray-800"
                        >
                          {WEEK_LABELS[entry.day]}
                        </label>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] ${statusStyles}`}>
                        {entry.is_open ? 'Open' : 'Closed'}
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label
                          htmlFor={`open-${entry.day}`}
                          className="text-xs uppercase tracking-[0.3em] text-gray-500"
                        >
                          Opens
                        </label>
                        <input
                          id={`open-${entry.day}`}
                          type="time"
                          value={entry.open_time}
                          onChange={(event) => handleHoursDraftChange(entry.day, 'open_time', event.target.value)}
                          disabled={!entry.is_open}
                          className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0 disabled:opacity-50"
                        />
                      </div>
                      <div className="space-y-1">
                        <label
                          htmlFor={`close-${entry.day}`}
                          className="text-xs uppercase tracking-[0.3em] text-gray-500"
                        >
                          Closes
                        </label>
                        <input
                          id={`close-${entry.day}`}
                          type="time"
                          value={entry.close_time}
                          onChange={(event) => handleHoursDraftChange(entry.day, 'close_time', event.target.value)}
                          disabled={!entry.is_open}
                          className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0 disabled:opacity-50"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">
              Scheduled closures
            </h3>
            <div className="rounded-3xl border border-gray-100 bg-gray-50 p-5">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <div className="space-y-2">
                  <label
                    htmlFor="closure-date"
                    className="text-xs uppercase tracking-[0.3em] text-gray-500"
                  >
                    Date
                  </label>
                  <input
                    id="closure-date"
                    type="date"
                    value={closureDateInput}
                    onChange={(event) => setClosureDateInput(event.target.value)}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="closure-reason"
                    className="text-xs uppercase tracking-[0.3em] text-gray-500"
                  >
                    Reason (optional)
                  </label>
                  <input
                    id="closure-reason"
                    type="text"
                    value={closureReasonInput}
                    onChange={(event) => setClosureReasonInput(event.target.value)}
                    placeholder="Staffing, holiday, or prep"
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAddClosure}
                    disabled={!closureDateInput || closureBusy}
                  >
                    <IconPlus className="h-4 w-4" />
                    Add closure
                  </Button>
                </div>
              </div>
              {closureFormError ? (
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-rose-500">
                  {closureFormError}
                </p>
              ) : null}
              <div className="mt-4 space-y-3">
                {closures.length ? (
                  closures.map((closure) => (
                    <div
                      key={closure.id}
                      className="space-y-3 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {formatClosureDate(closure.date)}
                          </p>
                          {closure.reason ? (
                            <p className="text-xs text-gray-500">{closure.reason}</p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => handleStartEditClosure(closure)}
                            disabled={closureBusy}
                            className="text-[11px] tracking-[0.2em]"
                          >
                            <IconPencil className="h-3 w-3" />
                            <span className="hidden uppercase tracking-[0.3em] sm:inline">Edit</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => requestClosureDelete(closure)}
                            disabled={closureBusy}
                            className="text-[11px] uppercase tracking-[0.3em] text-rose-500"
                          >
                            <IconTrash className="h-3 w-3" />
                            <span className="hidden uppercase tracking-[0.3em] sm:inline">Delete</span>
                          </Button>
                        </div>
                      </div>
                      {editingClosureId === closure.id ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <label
                              htmlFor={`closure-edit-date-${closure.id}`}
                              className="text-[11px] uppercase tracking-[0.3em] text-gray-500"
                            >
                              Date
                            </label>
                            <input
                              id={`closure-edit-date-${closure.id}`}
                              type="date"
                              value={editingClosureDate}
                              onChange={(event) => setEditingClosureDate(event.target.value)}
                              className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
                            />
                          </div>
                          <div className="space-y-2">
                            <label
                              htmlFor={`closure-edit-reason-${closure.id}`}
                              className="text-[11px] uppercase tracking-[0.3em] text-gray-500"
                            >
                              Reason (optional)
                            </label>
                            <input
                              id={`closure-edit-reason-${closure.id}`}
                              type="text"
                              value={editingClosureReason}
                              onChange={(event) => setEditingClosureReason(event.target.value)}
                              placeholder="Staffing, holiday, or prep"
                              className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
                            />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              onClick={handleSaveClosureEdit}
                              disabled={closureBusy}
                              className="text-[11px] tracking-[0.3em]"
                            >
                              Save
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={handleCancelEditClosure}
                              disabled={closureBusy}
                              className="text-[11px] tracking-[0.3em]"
                            >
                              Cancel
                            </Button>
                          </div>
                          {editingClosureError ? (
                            <p className="col-span-full text-xs uppercase tracking-[0.3em] text-rose-500">
                              {editingClosureError}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full border border-dashed border-gray-300 px-4 py-2 text-xs uppercase tracking-[0.3em] text-gray-500">
                    <IconCalendar className="h-4 w-4" />
                    No closures yet
                  </span>
                )}
              </div>
            </div>
          </section>
        </div>
      </Card>

      {renderDayModal()}
      {renderReservationModal()}

      <ConfirmDialog
        open={Boolean(confirmation)}
        title={confirmation?.title ?? 'Confirm'}
        description={confirmation?.description ?? ''}
        confirmLabel={
          confirmation?.type === 'delete'
            ? 'Delete'
            : confirmation?.type === 'create'
              ? 'Create'
              : confirmation?.type === 'closureDelete'
                ? 'Delete closure'
                : 'Save'
        }
        onConfirm={handleConfirm}
        onClose={() => {
          if (!confirmBusy) {
            setConfirmation(null);
          }
        }}
        busy={confirmBusy}
      >
        {confirmation?.type === 'update' && confirmation?.reservationId ? (
          <p>
            Reservation <strong>#{confirmation.reservationId}</strong> will be updated with the new details.
          </p>
        ) : null}
        {confirmation?.type === 'create' ? (
          <p>
            Status set to <strong>{confirmation.payload.status}</strong>.{' '}
            {confirmation.payload.scheduled_start
              ? `Scheduled start: ${new Date(confirmation.payload.scheduled_start).toLocaleString([], {
                dateStyle: 'medium',
                timeStyle: 'short'
              })}.`
              : 'No start date provided.'}
          </p>
        ) : null}
        {confirmation?.type === 'delete' ? (
          <p>This action cannot be undone.</p>
        ) : null}
        {confirmation?.type === 'schedule' ? (
          <ul className="space-y-1 text-sm text-gray-600">
            {confirmation.payload.operating_hours
              .filter((entry) => entry.is_open)
              .map((entry) => (
                <li key={entry.day}>
                  {WEEK_LABELS[entry.day]}: {entry.open_time} - {entry.close_time}
                </li>
              ))}
            {confirmation.payload.days_off.length ? (
              <li>Days off: {confirmation.payload.days_off.join(', ')}</li>
            ) : null}
          </ul>
        ) : null}
        {confirmation?.type === 'closureDelete' && confirmation?.closureDate ? (
          <p className="text-sm text-gray-600">
            Removing the closure scheduled for <strong>{formatClosureDate(confirmation.closureDate)}</strong>.
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
