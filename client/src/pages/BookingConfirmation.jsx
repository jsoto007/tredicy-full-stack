import { useMemo, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import FadeIn from '../components/FadeIn.jsx';
import Card from '../components/Card.jsx';
import Button from '../components/Button.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { formatStatusLabel, getStatusBadgeClasses } from '../lib/statusStyles.js';
import { apiGet, apiPost } from '../lib/api.js';
import { sanitizeAppointmentForConfirmation } from '../lib/appointments.js';

const BOOKING_RECEIPT_KEY = 'melodi-nails:last-booking';
const LOCATION_LINE = '1205 College Ave, Bronx, NY 10456';
const STUDIO_EMAIL = 'hello@melodinails.com';
const DIRECTIONS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(LOCATION_LINE)}`;
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

function storeLatestAppointment(appointment) {
  const sanitized = sanitizeAppointmentForConfirmation(appointment);
  if (!sanitized) {
    return;
  }
  try {
    sessionStorage.setItem(BOOKING_RECEIPT_KEY, JSON.stringify({ appointment: sanitized, savedAt: Date.now() }));
  } catch {
    // Ignore persistence failures (e.g. Safari private mode).
  }
}

export default function BookingConfirmation() {
  const { isAuthenticated } = useAuth();
  const [appointment, setAppointment] = useState(() => readLatestAppointment());

  const location = useLocation();
  const locationAppointment = location.state?.appointment ?? null;
  const [remoteAppointment, setRemoteAppointment] = useState(null);
  const [isFetchingRemote, setIsFetchingRemote] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const referenceQuery = searchParams.get('reference')?.trim();
  const emailQuery = searchParams.get('email')?.trim();
  const appointmentIdQuery = searchParams.get('appointment_id')?.trim();
  const sessionIdQuery = searchParams.get('session_id')?.trim();

  useEffect(() => {
    if (!appointmentIdQuery || !sessionIdQuery) {
      return;
    }
    let isActive = true;
    setIsFetchingRemote(true);
    setFetchError(null);
    apiPost('/api/payments/stripe/verify-session', {
      appointment_id: appointmentIdQuery,
      session_id: sessionIdQuery
    })
      .then((payload) => {
        if (!isActive) {
          return;
        }
        setRemoteAppointment(payload);
        storeLatestAppointment(payload);
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }
        setFetchError(error.message || 'Unable to verify Stripe payment.');
      })
      .finally(() => {
        if (isActive) {
          setIsFetchingRemote(false);
        }
      });
    return () => {
      isActive = false;
    };
  }, [appointmentIdQuery, sessionIdQuery]);

  useEffect(() => {
    if (appointment || remoteAppointment || !referenceQuery || !emailQuery) {
      return;
    }
    let isActive = true;
    const controller = new AbortController();
    setIsFetchingRemote(true);
    setFetchError(null);
    apiGet(
      `/api/public/appointments/lookup?reference=${encodeURIComponent(referenceQuery)}&email=${encodeURIComponent(
        emailQuery
      )}`,
      { signal: controller.signal }
    )
      .then((payload) => {
        if (!isActive) {
          return;
        }
        setRemoteAppointment(payload);
        storeLatestAppointment(payload);
      })
      .catch((error) => {
        if (!isActive || error.name === 'AbortError') {
          return;
        }
        setFetchError(error.message || 'Unable to load appointment details.');
      })
      .finally(() => {
        if (isActive) {
          setIsFetchingRemote(false);
        }
      });
    return () => {
      isActive = false;
      controller.abort();
    };
  }, [appointment, remoteAppointment, referenceQuery, emailQuery]);

  useEffect(() => {
    if (!locationAppointment) {
      return;
    }
    setAppointment(locationAppointment);
    storeLatestAppointment(locationAppointment);
  }, [locationAppointment]);

  const bookingDetails = remoteAppointment || appointment;
  const scheduledStart = bookingDetails?.scheduled_start ? new Date(bookingDetails.scheduled_start) : null;
  const formattedDateLabel = useMemo(
    () => (scheduledStart ? DAY_FORMATTER.format(scheduledStart) : 'Pending scheduling'),
    [scheduledStart]
  );
  const formattedTimeLabel = useMemo(
    () => (scheduledStart ? TIME_FORMATTER.format(scheduledStart) : 'To be confirmed'),
    [scheduledStart]
  );
  const timeZoneLabel = useMemo(() => getTimeZoneLabel(scheduledStart), [scheduledStart]);
  const durationLabel = formatDuration(bookingDetails?.duration_minutes);
  const suggestedDurationLabel =
    bookingDetails?.suggested_duration_minutes && bookingDetails?.suggested_duration_minutes !== bookingDetails?.duration_minutes
      ? formatDuration(bookingDetails.suggested_duration_minutes)
      : null;
  const payment = bookingDetails?.payments?.[0] || null;
  const depositLabel = payment
    ? new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: payment.currency || 'USD'
    }).format((payment.amount_cents || 0) / 100)
    : null;
  const contactName =
    bookingDetails?.contact_name ||
    bookingDetails?.contact?.name ||
    bookingDetails?.client?.display_name ||
    'Guest booking';
  const contactEmail =
    bookingDetails?.contact_email || bookingDetails?.contact?.email || bookingDetails?.client?.email || '—';
  const contactPhone =
    bookingDetails?.contact_phone || bookingDetails?.contact?.phone || bookingDetails?.client?.phone || '—';
  const serviceLabel =
    bookingDetails?.service?.name || bookingDetails?.session_option?.name || 'Service pending';
  const placementNotes =
    bookingDetails?.service?.notes || bookingDetails?.client_description || bookingDetails?.tattoo?.notes || '';
  const descriptionCopy = bookingDetails?.client_description || '';
  const artistName =
    bookingDetails?.assigned_admin?.name ||
    bookingDetails?.assigned_admin?.display_name ||
    'Assigned shortly';
  const artistEmail =
    bookingDetails?.assigned_admin?.email || bookingDetails?.assigned_admin?.contact_email || '';
  const statusLabel = formatStatusLabel(bookingDetails?.status);
  const statusClasses = getStatusBadgeClasses(bookingDetails?.status);
  const depositSecondary = payment?.receipt_url ? (
    <a
      href={payment.receipt_url}
      target="_blank"
      rel="noreferrer"
      className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 underline-offset-4 hover:underline"
    >
      View Stripe receipt
    </a>
  ) : (
    payment?.status || 'Captured during booking'
  );

  return (
    <main className="bg-white py-12 text-gray-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4">
        <FadeIn>
          <SectionTitle
            eyebrow="Booked"
            title="Appointment confirmed"
            description="Thanks for securing your appointment. We emailed a confirmation with calendar invites—check your inbox or spam folder."
          />
        </FadeIn>
        <FadeIn>
          <p className="text-sm text-gray-600">
            If you don’t see the email, double-check spam or promotions. The confirmation includes Google and Apple calendar options so you can lock in the time.
          </p>
        </FadeIn>

        {bookingDetails ? (
          <FadeIn className="space-y-6">
            <Card className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Reference</p>
                  <p className="text-2xl font-semibold tracking-[0.2em] text-gray-900">
                    {bookingDetails.reference_code || 'Pending'}
                  </p>
                  <p className="text-sm text-gray-500">Booked for {contactName}</p>
                </div>
                <span
                  className={`inline-flex w-fit items-center rounded-full px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] ${statusClasses}`}
                >
                  {statusLabel}
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
                  label="Appointment length"
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
                      className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 underline-offset-4 hover:underline"
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
                <DetailItem label="Payment" value={depositLabel || 'Recorded'} secondary={depositSecondary} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <DetailItem label="Booked for" value={contactName} secondary={contactEmail} />
                <DetailItem label="Phone" value={contactPhone} secondary="We’ll send reminders via SMS or email." />
              </div>

              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Appointment details</p>
                <p className="text-sm text-gray-900">{serviceLabel}</p>
                {placementNotes ? <p className="text-sm text-gray-600">{placementNotes}</p> : null}
                {descriptionCopy ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-gray-600">
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Client notes</p>
                    <p className="mt-2 leading-relaxed text-gray-700">{descriptionCopy}</p>
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
                  Book another appointment
                </Button>
              )}
            </div>
          </FadeIn>
        ) : isFetchingRemote ? (
          <FadeIn>
            <Card className="space-y-4">
              <p className="text-sm text-gray-600">Retrieving your booking details…</p>
              <p className="text-xs text-gray-500">
                If you received a reference and contact email in your booking confirmation, that pair will unlock this page again.
              </p>
            </Card>
          </FadeIn>
        ) : (
          <FadeIn>
            <Card className="space-y-4">
              <p className="text-sm text-gray-600">
                {fetchError ||
                  'We couldn’t find booking details for this session. Try refreshing the page or check your confirmation email for the link.'}
              </p>
              <p className="text-xs text-gray-500">
                Use the reference code and contact email sent to you (or revisit the confirmation link) to view the full details even without signing in.
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

const DAY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'long', month: 'long', day: 'numeric',
  timeZone: 'America/New_York'
});
const TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric', minute: '2-digit',
  timeZone: 'America/New_York'
});

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

function getTimeZoneLabel() {
  return 'ET';
}

function DetailItem({ label, value, secondary }) {
  const hasValue = !(value === undefined || value === null || value === '');
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.3em] text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{hasValue ? value : '—'}</p>
      {secondary
        ? typeof secondary === 'string'
          ? <p className="text-xs text-gray-500">{secondary}</p>
          : secondary
        : null}
    </div>
  );
}
