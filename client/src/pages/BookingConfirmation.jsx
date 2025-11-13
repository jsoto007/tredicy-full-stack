import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import FadeIn from '../components/FadeIn.jsx';
import Card from '../components/Card.jsx';
import Button from '../components/Button.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

const BOOKING_RECEIPT_KEY = 'black-ink:last-booking';
const LOCATION_LINE = '245 Mercer Street, Suite 4F, New York, NY';
const STUDIO_EMAIL = 'blackworknyc@gmail.com';
const DIRECTIONS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(LOCATION_LINE)}`;
const STATUS_DISPLAY = {
  pending: {
    label: 'Pending review',
    classes: 'bg-amber-100 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200'
  },
  confirmed: {
    label: 'Confirmed',
    classes: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-200'
  },
  completed: {
    label: 'Completed',
    classes: 'bg-slate-200 text-slate-900 dark:bg-slate-700/40 dark:text-slate-200'
  },
  cancelled: {
    label: 'Cancelled',
    classes: 'bg-rose-100 text-rose-800 dark:bg-rose-400/20 dark:text-rose-200'
  },
  default: {
    label: 'Scheduled',
    classes: 'bg-gray-200 text-gray-800 dark:bg-gray-700/40 dark:text-gray-200'
  }
};

function readLatestAppointment() {
  try {
    const raw = sessionStorage.getItem(BOOKING_RECEIPT_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return parsed?.appointment || null;
  } catch {
    return null;
  }
}

export default function BookingConfirmation() {
  const { isAuthenticated } = useAuth();
  const [appointment] = useState(() => readLatestAppointment());

  const scheduledStart = appointment?.scheduled_start ? new Date(appointment.scheduled_start) : null;
  const formattedDateLabel = useMemo(
    () => (scheduledStart ? DAY_FORMATTER.format(scheduledStart) : 'Pending scheduling'),
    [scheduledStart]
  );
  const formattedTimeLabel = useMemo(
    () => (scheduledStart ? TIME_FORMATTER.format(scheduledStart) : 'To be confirmed'),
    [scheduledStart]
  );
  const timeZoneLabel = useMemo(() => getTimeZoneLabel(scheduledStart), [scheduledStart]);
  const durationLabel = formatDuration(appointment?.duration_minutes);
  const suggestedDurationLabel =
    appointment?.suggested_duration_minutes && appointment?.suggested_duration_minutes !== appointment?.duration_minutes
      ? formatDuration(appointment.suggested_duration_minutes)
      : null;
  const payment = appointment?.payments?.[0] || null;
  const depositLabel = payment
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: payment.currency || 'USD'
      }).format((payment.amount_cents || 0) / 100)
    : null;
  const contactName = appointment?.contact_name || appointment?.contact?.name || appointment?.client?.display_name || 'Guest booking';
  const contactEmail = appointment?.contact_email || appointment?.contact?.email || appointment?.client?.email || '—';
  const contactPhone = appointment?.contact_phone || appointment?.contact?.phone || appointment?.client?.phone || '—';
  const placementLabel = appointment?.tattoo?.placement || appointment?.tattoo_placement || 'Placement pending';
  const sizeLabel = appointment?.tattoo?.size || appointment?.tattoo_size || 'Size pending';
  const placementNotes = appointment?.tattoo?.notes || appointment?.placement_notes || '';
  const descriptionCopy = appointment?.client_description || '';
  const artistName = appointment?.assigned_admin?.name || appointment?.assigned_admin?.display_name || 'Assigned shortly';
  const artistEmail = appointment?.assigned_admin?.email || appointment?.assigned_admin?.contact_email || '';
  const statusKey = (appointment?.status || '').toLowerCase();
  const statusDisplay = STATUS_DISPLAY[statusKey] || STATUS_DISPLAY.default;
  const depositSecondary = payment?.receipt_url ? (
    <a
      href={payment.receipt_url}
      target="_blank"
      rel="noreferrer"
      className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 underline-offset-4 hover:underline dark:text-gray-400"
    >
      View Square receipt
    </a>
  ) : (
    payment?.status || 'Captured during booking'
  );

  return (
    <main className="bg-white py-12 text-gray-900 dark:bg-black dark:text-gray-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4">
        <FadeIn>
          <SectionTitle
            eyebrow="Booked"
            title="Appointment confirmed"
            description="Thanks for securing your session. We’ll send a confirmation email shortly with next steps."
          />
        </FadeIn>

        {appointment ? (
          <FadeIn className="space-y-6">
            <Card className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Reference</p>
                  <p className="text-2xl font-semibold tracking-[0.2em] text-gray-900 dark:text-gray-100">
                    {appointment.reference_code || 'Pending'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Booked for {contactName}</p>
                </div>
                <span
                  className={`inline-flex w-fit items-center rounded-full px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] ${statusDisplay.classes}`}
                >
                  {statusDisplay.label}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <DetailItem
                  label="Date"
                  value={formattedDateLabel}
                  secondary={
                    scheduledStart ? 'Arrive 10 minutes early for check-in.' : 'We will email once the time is confirmed.'
                  }
                />
                <DetailItem
                  label="Start time"
                  value={formattedTimeLabel}
                  secondary={scheduledStart ? `${timeZoneLabel || 'Local'} time` : 'Scheduling in progress'}
                />
                <DetailItem
                  label="Session length"
                  value={durationLabel}
                  secondary={suggestedDurationLabel ? `Suggested ${suggestedDurationLabel}` : null}
                />
                <DetailItem
                  label="Studio"
                  value={LOCATION_LINE}
                  secondary={
                    <a
                      href={DIRECTIONS_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 underline-offset-4 hover:underline dark:text-gray-400"
                    >
                      View map
                    </a>
                  }
                />
                <DetailItem
                  label="Artist"
                  value={artistName}
                  secondary={artistEmail || 'Assigned shortly'}
                />
                <DetailItem label="Deposit" value={depositLabel || 'Recorded'} secondary={depositSecondary} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <DetailItem label="Booked for" value={contactName} secondary={contactEmail} />
                <DetailItem label="Phone" value={contactPhone} secondary="We’ll send reminders via SMS or email." />
              </div>

              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Tattoo details</p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {placementLabel} · {sizeLabel}
                </p>
                {placementNotes ? <p className="text-sm text-gray-600 dark:text-gray-300">{placementNotes}</p> : null}
                {descriptionCopy ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Client notes</p>
                    <p className="mt-2 leading-relaxed text-gray-700 dark:text-gray-200">{descriptionCopy}</p>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button as="a" href={DIRECTIONS_URL} target="_blank" rel="noreferrer">
                  Get directions
                </Button>
                <Button as="a" href={`mailto:${STUDIO_EMAIL}`} variant="secondary">
                  Email studio
                </Button>
                {payment?.receipt_url ? (
                  <Button as="a" href={payment.receipt_url} target="_blank" rel="noreferrer" variant="ghost">
                    View receipt
                  </Button>
                ) : null}
              </div>
            </Card>

            <div className="flex flex-wrap gap-3">
              <Button as={Link} to="/" variant="secondary">
                Return home
              </Button>
              {isAuthenticated ? (
                <Button as={Link} to="/portal/dashboard">
                  View dashboard
                </Button>
              ) : (
                <Button as={Link} to="/share-your-idea">
                  Book another session
                </Button>
              )}
            </div>
          </FadeIn>
        ) : (
          <FadeIn>
            <Card className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                We couldn’t find booking details for this session. If you just submitted a request, try refreshing this
                page or check your email for confirmation.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button as={Link} to="/share-your-idea">
                  Start a booking
                </Button>
                <Button as={Link} to="/" variant="secondary">
                  Back to home
                </Button>
              </div>
            </Card>
          </FadeIn>
        )}
      </div>
    </main>
  );
}

const DAY_FORMATTER = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const TIME_FORMATTER = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

function formatDuration(minutes) {
  if (!minutes || Number.isNaN(Number(minutes))) {
    return 'To be confirmed';
  }
  const hours = minutes / 60;
  if (Number.isInteger(hours)) {
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  return `${minutes} minutes`;
}

function getTimeZoneLabel(date) {
  if (!date) {
    return null;
  }
  const parts = date.toLocaleTimeString(undefined, { timeZoneName: 'short' }).split(' ');
  return parts[parts.length - 1] || null;
}

function DetailItem({ label, value, secondary }) {
  const hasValue = !(value === undefined || value === null || value === '');
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{hasValue ? value : '—'}</p>
      {secondary
        ? typeof secondary === 'string'
          ? <p className="text-xs text-gray-500 dark:text-gray-400">{secondary}</p>
          : secondary
        : null}
    </div>
  );
}
