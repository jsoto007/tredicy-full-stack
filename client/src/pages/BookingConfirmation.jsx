import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import FadeIn from '../components/FadeIn.jsx';
import Card from '../components/Card.jsx';
import Button from '../components/Button.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

const BOOKING_RECEIPT_KEY = 'black-ink:last-booking';
const LOCATION_LINE = '245 Mercer Street, Suite 4F, New York, NY';

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
  const formattedDate = useMemo(() => {
    if (!scheduledStart) {
      return 'Pending scheduling';
    }
    return `${DAY_FORMATTER.format(scheduledStart)} · ${TIME_FORMATTER.format(scheduledStart)}`;
  }, [scheduledStart]);

  const payment = appointment?.payments?.[0] || null;
  const depositLabel = payment
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: payment.currency || 'USD'
      }).format((payment.amount_cents || 0) / 100)
    : null;

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
            <Card className="space-y-5">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Reference</p>
                <p className="text-lg font-semibold tracking-[0.2em] text-gray-900 dark:text-gray-100">
                  {appointment.reference_code || 'Pending'}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Date & time</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{formattedDate}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Studio</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{LOCATION_LINE}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Artist</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    {appointment.assigned_admin?.name || 'Assigned shortly'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Deposit</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    {depositLabel ? `${depositLabel} · ${payment?.status ?? 'Paid'}` : 'Recorded'}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Tattoo details</p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {appointment.tattoo?.placement || appointment.tattoo_placement || 'Placement pending'} ·{' '}
                  {appointment.tattoo?.size || appointment.tattoo_size || 'Size pending'}
                </p>
                {appointment.client_description ? (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{appointment.client_description}</p>
                ) : null}
              </div>
            </Card>

            <div className="flex flex-wrap gap-3">
              <Button as={Link} to="/" variant="secondary">
                Return home
              </Button>
              {isAuthenticated ? (
                <Button as={Link} to="/dashboard/user">
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
