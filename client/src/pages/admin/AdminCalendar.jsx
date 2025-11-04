import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/Button.jsx';
import Card from '../../components/Card.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import SectionTitle from '../../components/SectionTitle.jsx';
import { useAdminDashboard } from './AdminDashboardContext.jsx';

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
  clientId: 'new-appointment-client-id',
  status: 'new-appointment-status',
  guestName: 'new-appointment-guest-name',
  guestEmail: 'new-appointment-guest-email',
  scheduledStart: 'new-appointment-scheduled-start',
  duration: 'new-appointment-duration',
  assignedAdmin: 'new-appointment-assigned-admin',
  guestPhone: 'new-appointment-guest-phone',
  description: 'new-appointment-description'
};

const NEW_DAY_OFF_ID = 'new-day-off-date';

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

function toDateTimeLocal(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (input) => input.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function fromDateTimeLocal(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function buildAppointmentUpdatePayload(draft) {
  return {
    status: draft.status?.trim() || 'pending',
    scheduled_start: draft.scheduled_start ? fromDateTimeLocal(draft.scheduled_start) : null,
    duration_minutes: draft.duration_minutes ? Number(draft.duration_minutes) : null,
    assigned_admin_id: draft.assigned_admin_id ? Number(draft.assigned_admin_id) : null,
    client_description: draft.client_description?.trim() || null
  };
}

function buildAppointmentCreatePayload(draft) {
  return {
    status: draft.status?.trim() || 'pending',
    client_id: draft.client_id ? Number(draft.client_id) : undefined,
    guest_name: draft.guest_name?.trim() || undefined,
    guest_email: draft.guest_email?.trim() || undefined,
    guest_phone: draft.guest_phone?.trim() || undefined,
    scheduled_start: draft.scheduled_start ? fromDateTimeLocal(draft.scheduled_start) : null,
    duration_minutes: draft.duration_minutes ? Number(draft.duration_minutes) : null,
    assigned_admin_id: draft.assigned_admin_id ? Number(draft.assigned_admin_id) : null,
    client_description: draft.client_description?.trim() || undefined
  };
}

function normaliseOperatingHours(hours) {
  const incoming = new Map();
  ensureArray(hours).forEach((entry) => {
    if (entry?.day) {
      incoming.set(entry.day, {
        day: entry.day,
        is_open: Boolean(entry.is_open),
        open_time: entry.open_time || '10:00',
        close_time: entry.close_time || '18:00'
      });
    }
  });
  return WEEK_ORDER.map((day) => {
    if (incoming.has(day)) {
      return { ...incoming.get(day) };
    }
    const defaults =
      day === 'saturday'
        ? { open_time: '10:00', close_time: '16:00' }
        : day === 'sunday'
        ? { open_time: '10:00', close_time: '14:00', is_open: false }
        : { open_time: '10:00', close_time: '18:00', is_open: true };
    return {
      day,
      is_open: defaults.is_open ?? true,
      open_time: defaults.open_time,
      close_time: defaults.close_time
    };
  });
}

function ensureArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value;
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

const CRUD_MODE_OPTIONS = [
  { value: 'create', label: 'Create', icon: IconPlus },
  { value: 'read', label: 'Read', icon: IconEye },
  { value: 'update', label: 'Update', icon: IconPencil },
  { value: 'delete', label: 'Delete', icon: IconTrash }
];

export default function AdminCalendar() {
  const {
    state: { appointments, admins, schedule },
    actions: {
      setFeedback,
      createAppointment,
      updateAppointment,
      deleteAppointment,
      updateSchedule
    }
  } = useAdminDashboard();
  const navigate = useNavigate();

  const [appointmentDrafts, setAppointmentDrafts] = useState({});
  const [newAppointmentDraft, setNewAppointmentDraft] = useState(NEW_APPOINTMENT_TEMPLATE);
  const [hoursDraft, setHoursDraft] = useState(normaliseOperatingHours(schedule.operating_hours));
  const [daysOffDraft, setDaysOffDraft] = useState(ensureArray(schedule.days_off));
  const [newDayOff, setNewDayOff] = useState('');
  const [mode, setMode] = useState('read');
  const [confirmation, setConfirmation] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  useEffect(() => {
    const drafts = {};
    appointments.forEach((appointment) => {
      drafts[appointment.id] = {
        status: appointment.status || 'pending',
        scheduled_start: toDateTimeLocal(appointment.scheduled_start),
        duration_minutes: appointment.duration_minutes ?? '',
        assigned_admin_id: appointment.assigned_admin?.id ? String(appointment.assigned_admin.id) : '',
        client_description: appointment.client_description || ''
      };
    });
    setAppointmentDrafts(drafts);
  }, [appointments]);

  useEffect(() => {
    setHoursDraft(normaliseOperatingHours(schedule.operating_hours));
  }, [schedule.operating_hours]);

  useEffect(() => {
    setDaysOffDraft(ensureArray(schedule.days_off).slice().sort());
  }, [schedule.days_off]);

  const adminOptions = useMemo(
    () => admins.map((admin) => ({ value: String(admin.id), label: admin.name })),
    [admins]
  );

  const sortedAppointments = useMemo(() => {
    return appointments
      .slice()
      .sort((a, b) => {
        const aTime = a.scheduled_start ? new Date(a.scheduled_start).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.scheduled_start ? new Date(b.scheduled_start).getTime() : Number.MAX_SAFE_INTEGER;
        if (aTime === bTime) {
          return (b.created_at ? new Date(b.created_at).getTime() : 0) - (a.created_at ? new Date(a.created_at).getTime() : 0);
        }
        return aTime - bTime;
      });
  }, [appointments]);

  const handleAppointmentDraftChange = (appointmentId, field, value) => {
    setAppointmentDrafts((prev) => ({
      ...prev,
      [appointmentId]: {
        ...prev[appointmentId],
        [field]: value
      }
    }));
  };

  const handleCreateDraftChange = (field, value) => {
    setNewAppointmentDraft((prev) => ({
      ...prev,
      [field]: value
    }));
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

  const requestAppointmentUpdate = (appointmentId) => {
    const draft = appointmentDrafts[appointmentId];
    if (!draft) {
      return;
    }
    const payload = buildAppointmentUpdatePayload(draft);
    if (!payload.status) {
      setFeedback({ tone: 'offline', message: 'Status is required.' });
      return;
    }
    setConfirmation({
      type: 'update',
      appointmentId,
      payload,
      title: 'Update appointment',
      description: `Apply scheduling changes to appointment #${appointmentId}?`
    });
  };

  const requestAppointmentDelete = (appointment) => {
    setConfirmation({
      type: 'delete',
      appointmentId: appointment.id,
      title: 'Delete appointment',
      description: `This will remove appointment ${appointment.reference_code || `#${appointment.id}`}.`
    });
  };

  const requestAppointmentCreate = () => {
    const payload = buildAppointmentCreatePayload(newAppointmentDraft);
    if (!payload.client_id && (!payload.guest_name || !payload.guest_email)) {
      setFeedback({ tone: 'offline', message: 'Provide client ID or guest name and email.' });
      return;
    }
    setConfirmation({
      type: 'create',
      payload,
      title: 'Create appointment',
      description: 'Add this appointment to the calendar?'
    });
  };

  const requestScheduleUpdate = () => {
    setConfirmation({
      type: 'schedule',
      payload: {
        operating_hours: hoursDraft,
        days_off: daysOffDraft
      },
      title: 'Update studio schedule',
      description: 'Save these operating hours and days off?'
    });
  };

  const handleConfirm = async () => {
    if (!confirmation) {
      return;
    }
    setConfirmBusy(true);
    try {
      if (confirmation.type === 'create') {
        await createAppointment(confirmation.payload);
        setNewAppointmentDraft(NEW_APPOINTMENT_TEMPLATE);
      } else if (confirmation.type === 'update') {
        await updateAppointment(confirmation.appointmentId, confirmation.payload);
      } else if (confirmation.type === 'delete') {
        await deleteAppointment(confirmation.appointmentId);
      } else if (confirmation.type === 'schedule') {
        await updateSchedule(confirmation.payload);
      }
      setConfirmation(null);
    } catch (err) {
      setFeedback({
        tone: 'offline',
        message:
          confirmation.type === 'create'
            ? 'Unable to create appointment.'
            : confirmation.type === 'update'
            ? 'Unable to update appointment.'
            : confirmation.type === 'delete'
            ? 'Unable to delete appointment.'
            : 'Unable to update studio schedule.'
      });
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleAddDayOff = () => {
    if (!newDayOff) {
      return;
    }
    setDaysOffDraft((prev) => {
      if (prev.includes(newDayOff)) {
        return prev;
      }
      return [...prev, newDayOff].sort();
    });
    setNewDayOff('');
  };

  const handleRemoveDayOff = (day) => {
    setDaysOffDraft((prev) => prev.filter((entry) => entry !== day));
  };

  const renderEmptyState = (message) => (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
      <IconCalendar className="h-8 w-8 text-gray-400 dark:text-gray-500" />
      <p>{message}</p>
    </div>
  );

  const handleCreateSubmit = (event) => {
    event.preventDefault();
    requestAppointmentCreate();
  };

  const renderCreatePanel = () => (
    <form className="space-y-6" onSubmit={handleCreateSubmit}>
      <div className="flex items-center gap-3 text-gray-700 dark:text-gray-200">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900">
          <IconPlus className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em]">Create appointment</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Schedule time for a client or guest.</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor={NEW_APPOINTMENT_FIELD_IDS.clientId}
            className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
          >
            Client ID
          </label>
          <input
            id={NEW_APPOINTMENT_FIELD_IDS.clientId}
            type="number"
            min="1"
            value={newAppointmentDraft.client_id}
            onChange={(event) => handleCreateDraftChange('client_id', event.target.value)}
            className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-gray-400"
            placeholder="Existing client?"
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor={NEW_APPOINTMENT_FIELD_IDS.status}
            className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
          >
            Status
          </label>
          <input
            id={NEW_APPOINTMENT_FIELD_IDS.status}
            type="text"
            value={newAppointmentDraft.status}
            onChange={(event) => handleCreateDraftChange('status', event.target.value)}
            className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-gray-400"
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor={NEW_APPOINTMENT_FIELD_IDS.guestName}
            className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
          >
            Guest name
          </label>
          <input
            id={NEW_APPOINTMENT_FIELD_IDS.guestName}
            type="text"
            value={newAppointmentDraft.guest_name}
            onChange={(event) => handleCreateDraftChange('guest_name', event.target.value)}
            className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-gray-400"
            placeholder="Required if no client ID"
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor={NEW_APPOINTMENT_FIELD_IDS.guestEmail}
            className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
          >
            Guest email
          </label>
          <input
            id={NEW_APPOINTMENT_FIELD_IDS.guestEmail}
            type="email"
            value={newAppointmentDraft.guest_email}
            onChange={(event) => handleCreateDraftChange('guest_email', event.target.value)}
            className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-gray-400"
            placeholder="Required if no client ID"
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor={NEW_APPOINTMENT_FIELD_IDS.scheduledStart}
            className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
          >
            Start
          </label>
          <input
            id={NEW_APPOINTMENT_FIELD_IDS.scheduledStart}
            type="datetime-local"
            value={newAppointmentDraft.scheduled_start}
            onChange={(event) => handleCreateDraftChange('scheduled_start', event.target.value)}
            className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-gray-400"
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor={NEW_APPOINTMENT_FIELD_IDS.duration}
            className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
          >
            Duration (min)
          </label>
          <input
            id={NEW_APPOINTMENT_FIELD_IDS.duration}
            type="number"
            min="0"
            step="15"
            value={newAppointmentDraft.duration_minutes}
            onChange={(event) => handleCreateDraftChange('duration_minutes', event.target.value)}
            className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-gray-400"
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor={NEW_APPOINTMENT_FIELD_IDS.assignedAdmin}
            className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
          >
            Assign admin
          </label>
          <select
            id={NEW_APPOINTMENT_FIELD_IDS.assignedAdmin}
            value={newAppointmentDraft.assigned_admin_id}
            onChange={(event) => handleCreateDraftChange('assigned_admin_id', event.target.value)}
            className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-gray-400"
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
            className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
          >
            Guest phone
          </label>
          <input
            id={NEW_APPOINTMENT_FIELD_IDS.guestPhone}
            type="tel"
            value={newAppointmentDraft.guest_phone}
            onChange={(event) => handleCreateDraftChange('guest_phone', event.target.value)}
            className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-gray-400"
          />
        </div>
      </div>
      <div className="space-y-2">
        <label
          htmlFor={NEW_APPOINTMENT_FIELD_IDS.description}
          className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
        >
          Notes
        </label>
        <textarea
          id={NEW_APPOINTMENT_FIELD_IDS.description}
          rows={3}
          value={newAppointmentDraft.client_description}
          onChange={(event) => handleCreateDraftChange('client_description', event.target.value)}
          placeholder="Client or session notes (optional)"
          className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-gray-400"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">A confirmation dialog appears before saving.</p>
        <Button type="submit">
          <IconPlus className="h-4 w-4" />
          Add to calendar
        </Button>
      </div>
    </form>
  );

  const renderReadPanel = () => {
    if (!sortedAppointments.length) {
      return renderEmptyState('No appointments scheduled yet.');
    }

    return (
      <ol className="space-y-3">
        {sortedAppointments.map((appointment) => {
          const scheduledDate = appointment.scheduled_start ? new Date(appointment.scheduled_start) : null;
          const formattedDate = scheduledDate
            ? scheduledDate.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
            : 'Awaiting schedule';
          const clientName = appointment.client?.display_name || appointment.guest_name || 'Guest client';
          const contact = appointment.client?.email || appointment.guest_email || appointment.guest_phone || 'No contact info';
          const reference = appointment.reference_code || `#${appointment.id}`;
          const assigned =
            appointment.assigned_admin?.name ||
            appointment.assigned_admin?.display_name ||
            appointment.assigned_admin?.email ||
            'Unassigned';
          const isDayOff =
            scheduledDate && daysOffDraft.includes(scheduledDate.toISOString().slice(0, 10));

          return (
            <li
              key={appointment.id}
            >
              <button
                type="button"
                onClick={() => navigate(`${appointment.id}`)}
                className="group flex w-full flex-wrap items-center gap-4 rounded-3xl border border-gray-200 bg-gray-50 p-4 text-left shadow-sm transition hover:border-gray-300 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700 dark:hover:bg-gray-950 dark:focus-visible:outline-gray-100"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-gray-700 shadow-sm transition group-hover:scale-[1.02] dark:bg-gray-950 dark:text-gray-200">
                  <IconCalendar className="h-6 w-6" />
                </span>
                <div className="min-w-[200px] flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 transition group-hover:text-gray-700 dark:text-gray-100 dark:group-hover:text-gray-200">
                      {clientName}
                    </p>
                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-gray-600 shadow-sm dark:bg-gray-950 dark:text-gray-300">
                      {appointment.status || 'pending'}
                      {isDayOff ? (
                        <span className="ml-2 rounded-full bg-red-500 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.3em] text-white">
                          Day off
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formattedDate}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Ref {reference} · Assigned to {assigned}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{contact}</p>
                </div>
                <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-gray-500 transition group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-gray-100">
                  <IconEye className="h-4 w-4" />
                  <span className="hidden sm:inline">Open</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    );
  };

  const renderUpdatePanel = () => {
    if (!sortedAppointments.length) {
      return renderEmptyState('Nothing to update yet. Create an appointment to begin.');
    }

    return (
      <div className="space-y-4">
        {sortedAppointments.map((appointment) => {
          const draft = appointmentDrafts[appointment.id] || {
            status: appointment.status || 'pending',
            scheduled_start: '',
            duration_minutes: '',
            assigned_admin_id: '',
            client_description: appointment.client_description || ''
          };
          const scheduledDate = appointment.scheduled_start ? new Date(appointment.scheduled_start) : null;
          const baseId = `appointment-${appointment.id}`;
          const statusId = `${baseId}-status`;
          const startId = `${baseId}-start`;
          const durationId = `${baseId}-duration`;
          const adminId = `${baseId}-assigned-admin`;
          const notesId = `${baseId}-notes`;

          return (
            <div
              key={appointment.id}
              className="space-y-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                    Ref {appointment.reference_code || appointment.id}
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {appointment.client?.display_name || appointment.guest_name || 'Guest client'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {scheduledDate
                      ? scheduledDate.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
                      : 'Awaiting schedule'}
                  </p>
                </div>
                <Button type="button" variant="ghost" onClick={() => navigate(`${appointment.id}`)}>
                  <IconEye className="h-4 w-4" />
                  <span className="hidden text-xs uppercase tracking-[0.3em] sm:inline">Details</span>
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor={statusId}
                    className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
                  >
                    Status
                  </label>
                  <input
                    id={statusId}
                    type="text"
                    value={draft.status}
                    onChange={(event) => handleAppointmentDraftChange(appointment.id, 'status', event.target.value)}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor={startId}
                    className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
                  >
                    Start
                  </label>
                  <input
                    id={startId}
                    type="datetime-local"
                    value={draft.scheduled_start}
                    onChange={(event) =>
                      handleAppointmentDraftChange(appointment.id, 'scheduled_start', event.target.value)
                    }
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor={durationId}
                    className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
                  >
                    Duration (min)
                  </label>
                  <input
                    id={durationId}
                    type="number"
                    min="0"
                    step="15"
                    value={draft.duration_minutes}
                    onChange={(event) =>
                      handleAppointmentDraftChange(appointment.id, 'duration_minutes', event.target.value)
                    }
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor={adminId}
                    className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
                  >
                    Assigned admin
                  </label>
                  <select
                    id={adminId}
                    value={draft.assigned_admin_id}
                    onChange={(event) =>
                      handleAppointmentDraftChange(appointment.id, 'assigned_admin_id', event.target.value)
                    }
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-gray-400"
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
                  className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
                >
                  Notes
                </label>
                <textarea
                  id={notesId}
                  rows={3}
                  value={draft.client_description}
                  onChange={(event) =>
                    handleAppointmentDraftChange(appointment.id, 'client_description', event.target.value)
                  }
                  className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-gray-400"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Last update{' '}
                  {appointment.updated_at
                    ? new Date(appointment.updated_at).toLocaleString([], {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      })
                    : 'n/a'}
                </p>
                <Button type="button" onClick={() => requestAppointmentUpdate(appointment.id)}>
                  <IconPencil className="h-4 w-4" />
                  Save changes
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDeletePanel = () => {
    if (!sortedAppointments.length) {
      return renderEmptyState('You have no appointments to remove.');
    }

    return (
      <div className="space-y-3">
        {sortedAppointments.map((appointment) => {
          const scheduledDate = appointment.scheduled_start ? new Date(appointment.scheduled_start) : null;
          const formattedDate = scheduledDate
            ? scheduledDate.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
            : 'Awaiting schedule';
          const clientName = appointment.client?.display_name || appointment.guest_name || 'Guest client';

          return (
            <div
              key={appointment.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950"
            >
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {clientName}
                  <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                    Ref {appointment.reference_code || appointment.id}
                  </span>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{formattedDate}</p>
              </div>
              <Button type="button" variant="secondary" onClick={() => requestAppointmentDelete(appointment)}>
                <IconTrash className="h-4 w-4" />
                Delete
              </Button>
            </div>
          );
        })}
      </div>
    );
  };

  const renderModePanel = () => {
    if (mode === 'create') {
      return renderCreatePanel();
    }
    if (mode === 'update') {
      return renderUpdatePanel();
    }
    if (mode === 'delete') {
      return renderDeletePanel();
    }
    return renderReadPanel();
  };

  const appointmentCountLabel =
    sortedAppointments.length === 1 ? '1 appointment scheduled' : `${sortedAppointments.length} appointments scheduled`;

  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="Admin"
        title="Calendar & availability"
        description="Keep the studio schedule organised with a single, focused control centre."
      />

      <Card className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900">
              <IconCalendar className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                Studio calendar
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">{appointmentCountLabel}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-full border border-gray-200 p-1 dark:border-gray-700">
            {CRUD_MODE_OPTIONS.map(({ value, label, icon: Icon }) => {
              const isActive = mode === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  aria-pressed={isActive}
                  aria-label={`${label} mode`}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                    isActive
                      ? 'bg-gray-900 text-white shadow-sm dark:bg-gray-100 dark:text-gray-900'
                      : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          {renderModePanel()}
        </div>
      </Card>

      <Card className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900">
              <IconClock className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                Studio availability
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">Manage weekly hours and closures.</p>
            </div>
          </div>
          <Button type="button" onClick={requestScheduleUpdate}>
            <IconPencil className="h-4 w-4" />
            Save availability
          </Button>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
              Operating hours
            </h3>
            <div className="space-y-3">
              {hoursDraft.map((entry) => (
                <div
                  key={entry.day}
                  className="flex flex-wrap items-center gap-3 rounded-3xl bg-gray-50 p-4 dark:bg-gray-900"
                >
                  <div className="flex items-center gap-2">
                    <input
                      id={`hours-${entry.day}`}
                      type="checkbox"
                      checked={entry.is_open}
                      onChange={(event) => handleHoursDraftChange(entry.day, 'is_open', event.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 dark:border-gray-600 dark:bg-gray-950 dark:focus:ring-gray-100"
                    />
                    <label
                      htmlFor={`hours-${entry.day}`}
                      className="text-sm font-semibold text-gray-800 dark:text-gray-100"
                    >
                      {WEEK_LABELS[entry.day]}
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor={`open-${entry.day}`} className="sr-only">
                      {WEEK_LABELS[entry.day]} open time
                    </label>
                    <input
                      id={`open-${entry.day}`}
                      type="time"
                      value={entry.open_time}
                      onChange={(event) => handleHoursDraftChange(entry.day, 'open_time', event.target.value)}
                      disabled={!entry.is_open}
                      className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-gray-400"
                    />
                    <span className="text-xs uppercase tracking-[0.3em] text-gray-400 dark:text-gray-500">to</span>
                    <label htmlFor={`close-${entry.day}`} className="sr-only">
                      {WEEK_LABELS[entry.day]} close time
                    </label>
                    <input
                      id={`close-${entry.day}`}
                      type="time"
                      value={entry.close_time}
                      onChange={(event) => handleHoursDraftChange(entry.day, 'close_time', event.target.value)}
                      disabled={!entry.is_open}
                      className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-gray-400"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
              Scheduled closures
            </h3>
            <div className="rounded-3xl border border-gray-100 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex flex-wrap items-end gap-3">
                <div className="grow space-y-2">
                  <label
                    htmlFor={NEW_DAY_OFF_ID}
                    className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
                  >
                    Date
                  </label>
                  <input
                    id={NEW_DAY_OFF_ID}
                    type="date"
                    value={newDayOff}
                    onChange={(event) => setNewDayOff(event.target.value)}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-gray-400"
                  />
                </div>
                <Button type="button" variant="secondary" onClick={handleAddDayOff}>
                  <IconPlus className="h-4 w-4" />
                  Add
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {daysOffDraft.map((day) => (
                  <span
                    key={day}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-gray-600 shadow-sm dark:bg-gray-950 dark:text-gray-300"
                  >
                    {new Date(day).toLocaleDateString()}
                    <button
                      type="button"
                      onClick={() => handleRemoveDayOff(day)}
                      className="rounded-full bg-gray-900 px-2 py-[2px] text-[10px] font-bold text-white transition hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                      aria-label={`Remove ${day}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {!daysOffDraft.length ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-dashed border-gray-300 px-4 py-2 text-xs uppercase tracking-[0.3em] text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    <IconCalendar className="h-4 w-4" />
                    No closures yet
                  </span>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </Card>

      <ConfirmDialog
        open={Boolean(confirmation)}
        title={confirmation?.title ?? 'Confirm'}
        description={confirmation?.description ?? ''}
        confirmLabel={
          confirmation?.type === 'delete'
            ? 'Delete'
            : confirmation?.type === 'create'
            ? 'Create'
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
        {confirmation?.type === 'update' && confirmation?.appointmentId ? (
          <p>
            Appointment <strong>#{confirmation.appointmentId}</strong> will be updated with the new details.
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
          <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
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
      </ConfirmDialog>
    </div>
  );
}
