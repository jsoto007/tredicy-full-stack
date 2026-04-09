import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Badge from '../../components/Badge.jsx';
import Button from '../../components/Button.jsx';
import Card from '../../components/Card.jsx';
import Dialog from '../../components/Dialog.jsx';
import SectionTitle from '../../components/SectionTitle.jsx';
import Tabs from '../../components/Tabs.jsx';
import { useClientPortal } from '../../contexts/ClientPortalContext.jsx';
import { getReservationTypeLabel } from '../../lib/reservations.js';
import { formatStatusLabel, getStatusBadgeClasses } from '../../lib/statusStyles.js';

const PAST_STATUSES = new Set(['cancelled', 'cancelled_by_client', 'declined', 'completed', 'no_show']);

function formatDate(value) {
  if (!value) {
    return 'TBD';
  }
  try {
    return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'TBD';
  }
}

function formatTime(value) {
  if (!value) {
    return 'TBD';
  }
  try {
    return new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch {
    return 'TBD';
  }
}

function formatDialogTitle(value) {
  if (!value) {
    return 'Note';
  }
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function ClientReservationsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('upcoming');
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [actionDialog, setActionDialog] = useState(null);
  const { loading, error, reservations } = useClientPortal();

  const upcomingReservations = useMemo(() => {
    const now = Date.now();
    return [...(reservations || [])]
      .filter((reservation) => {
        const isPast = PAST_STATUSES.has(reservation.status);
        if (isPast) {
          return false;
        }
        const start = reservation.scheduled_start ? new Date(reservation.scheduled_start).getTime() : null;
        if (start && start < now) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aTime = a.scheduled_start ? new Date(a.scheduled_start).getTime() : Infinity;
        const bTime = b.scheduled_start ? new Date(b.scheduled_start).getTime() : Infinity;
        return aTime - bTime;
      });
  }, [reservations]);

  const pastReservations = useMemo(() => {
    const now = Date.now();
    return [...(reservations || [])]
      .filter((reservation) => {
        const isPastStatus = PAST_STATUSES.has(reservation.status);
        const start = reservation.scheduled_start ? new Date(reservation.scheduled_start).getTime() : null;
        if (isPastStatus) {
          return true;
        }
        if (start && start < now) {
          return true;
        }
        return false;
      })
      .sort((a, b) => {
        const aTime = a.scheduled_start ? new Date(a.scheduled_start).getTime() : 0;
        const bTime = b.scheduled_start ? new Date(b.scheduled_start).getTime() : 0;
        return bTime - aTime;
      });
  }, [reservations]);

  useEffect(() => {
    const focusId = location.state?.focus;
    if (!focusId || !reservations?.length) {
      return;
    }
    const target = reservations.find((reservation) => String(reservation.id) === String(focusId));
    if (target) {
      setSelectedReservation(target);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate, reservations]);

  const handleActionClick = (type, reservation) => {
    setActionDialog({ type, reservation });
  };

  const buildActionMessage = () => {
    if (!actionDialog) {
      return null;
    }
    if (actionDialog.type === 'reschedule') {
      return 'Rescheduling is managed by the studio. Reply to your confirmation email or message the shop to request a new slot.';
    }
    if (actionDialog.type === 'cancel') {
      return 'Need to cancel? Please notify us at least 48 hours ahead so we can release your session.';
    }
    return null;
  };

  const renderReservationList = (items, variant) => {
    if (!items.length) {
      const message = variant === 'upcoming'
        ? 'You don’t have any upcoming sessions yet.'
        : 'No past sessions yet. Once your first session is complete, it will appear here.';
      return (
        <Card className="flex flex-col items-start gap-3 text-xs uppercase tracking-[0.3em] text-gray-500">
          <p>{message}</p>
          <Button as={Link} to="/reservations/new" variant="ghost">
            Book consult
          </Button>
        </Card>
      );
    }
    return (
      <div className="space-y-4">
        {items.map((reservation) => {
          return (
            <article
              key={reservation.id}
              className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white/80 p-4 text-sm text-gray-700 shadow-sm sm:flex-row sm:items-center"
            >
              <div className="w-full sm:w-32">
                <p className="text-xs uppercase tracking-[0.4em] text-gray-500">{formatDate(reservation.scheduled_start)}</p>
                <p className="text-lg font-semibold text-gray-900">{formatTime(reservation.scheduled_start)}</p>
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-[0.65rem] uppercase tracking-[0.3em] text-gray-500">
                  {getReservationTypeLabel(reservation)}
                </p>
                {reservation.assigned_admin ? (
                  <p className="text-sm font-semibold text-gray-900">{reservation.assigned_admin.name}</p>
                ) : null}
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em]">
                  <Badge className={getStatusBadgeClasses(reservation.status)}>
                    {formatStatusLabel(reservation.status)}
                  </Badge>
                  {reservation.service?.name ? (
                    <span className="text-gray-500">{reservation.service.name}</span>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em]">
                <Button variant="ghost" onClick={() => setSelectedReservation(reservation)}>
                  View details
                </Button>
                {variant === 'upcoming' ? (
                  <>
                    <Button variant="ghost" onClick={() => handleActionClick('reschedule', reservation)}>
                      Reschedule
                    </Button>
                    <Button variant="ghost" onClick={() => handleActionClick('cancel', reservation)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" onClick={() => navigate('/reservations/new')}>
                    Rebook
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <main className="space-y-6">
        <SectionTitle eyebrow="Client portal" title="Reservations" description="Loading your schedule…" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="space-y-6">
        <SectionTitle eyebrow="Client portal" title="Reservations" description="We hit a snag." />
        <Card className="text-xs uppercase tracking-[0.3em] text-rose-600">{error}</Card>
        <Button as={Link} to="/auth" variant="secondary">
          Return to sign in
        </Button>
      </main>
    );
  }

  const tabs = [
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'past', label: 'Past' }
  ];

  return (
    <div className="space-y-6">
      <SectionTitle eyebrow="Client portal" title="Reservations" description="A clean view of your schedule." />
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Reservations</p>
            <p className="text-sm text-gray-500">Manage your studio time with confidence.</p>
          </div>
          <Button as={Link} to="/reservations/new">
            Book consult
          </Button>
        </div>
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} renderPanel={(tabId) => {
          if (tabId === 'upcoming') {
            return renderReservationList(upcomingReservations, 'upcoming');
          }
          return renderReservationList(pastReservations, 'past');
        }} />
      </Card>

      <Dialog
        open={!!actionDialog}
        onClose={() => setActionDialog(null)}
        title={actionDialog ? formatDialogTitle(actionDialog.type) : 'Note'}
        footer={<Button onClick={() => setActionDialog(null)}>Close</Button>}
      >
        <p className="text-sm text-gray-600">{buildActionMessage()}</p>
      </Dialog>

      <Dialog
        open={!!selectedReservation}
        onClose={() => setSelectedReservation(null)}
        title="Reservation details"
        footer={<Button onClick={() => setSelectedReservation(null)}>Close</Button>}
      >
        {selectedReservation ? (
          <div className="space-y-3 text-sm text-gray-700">
            <p className="font-semibold text-gray-900">{formatDate(selectedReservation.scheduled_start)} · {formatTime(selectedReservation.scheduled_start)}</p>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
              {getReservationTypeLabel(selectedReservation)}
            </p>
            {selectedReservation.assigned_admin ? (
              <p>Artist: {selectedReservation.assigned_admin.name}</p>
            ) : null}
                    <p>
                      Status:{' '}
                      <span className={getStatusBadgeClasses(selectedReservation.status)}>
                        {formatStatusLabel(selectedReservation.status)}
                      </span>
                    </p>
            {selectedReservation.service?.notes ? <p>Notes: {selectedReservation.service.notes}</p> : null}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
