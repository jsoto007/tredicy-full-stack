import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Badge from '../../components/Badge.jsx';
import Button from '../../components/Button.jsx';
import Card from '../../components/Card.jsx';
import Dialog from '../../components/Dialog.jsx';
import SectionTitle from '../../components/SectionTitle.jsx';
import Tabs from '../../components/Tabs.jsx';
import { useClientPortal } from '../../contexts/ClientPortalContext.jsx';

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

function statusLabel(status) {
  if (!status) {
    return 'Confirmed';
  }
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusTone(status) {
  switch (status) {
    case 'cancelled':
    case 'cancelled_by_client':
    case 'declined':
      return 'text-rose-700 dark:text-rose-300';
    case 'completed':
      return 'text-emerald-700 dark:text-emerald-300';
    case 'pending':
      return 'text-amber-700 dark:text-amber-300';
    default:
      return 'text-gray-700 dark:text-gray-200';
  }
}

export default function ClientAppointmentsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('upcoming');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [actionDialog, setActionDialog] = useState(null);
  const { loading, error, appointments } = useClientPortal();

  const upcomingAppointments = useMemo(() => {
    const now = Date.now();
    return [...(appointments || [])]
      .filter((appointment) => {
        const isPast = PAST_STATUSES.has(appointment.status);
        if (isPast) {
          return false;
        }
        const start = appointment.scheduled_start ? new Date(appointment.scheduled_start).getTime() : null;
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
  }, [appointments]);

  const pastAppointments = useMemo(() => {
    const now = Date.now();
    return [...(appointments || [])]
      .filter((appointment) => {
        const isPastStatus = PAST_STATUSES.has(appointment.status);
        const start = appointment.scheduled_start ? new Date(appointment.scheduled_start).getTime() : null;
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
  }, [appointments]);

  useEffect(() => {
    const focusId = location.state?.focus;
    if (!focusId || !appointments?.length) {
      return;
    }
    const target = appointments.find((appointment) => String(appointment.id) === String(focusId));
    if (target) {
      setSelectedAppointment(target);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate, appointments]);

  const handleActionClick = (type, appointment) => {
    setActionDialog({ type, appointment });
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

  const renderAppointmentList = (items, variant) => {
    if (!items.length) {
      const message = variant === 'upcoming'
        ? 'You don’t have any upcoming sessions yet.'
        : 'No past sessions yet. Once your first session is complete, it will appear here.';
      return (
        <Card className="flex flex-col items-start gap-3 text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
          <p>{message}</p>
          <Button as={Link} to="/share-your-idea" variant="ghost">
            Book consult
          </Button>
        </Card>
      );
    }
    return (
      <div className="space-y-4">
        {items.map((appointment) => {
          const start = appointment.scheduled_start ? new Date(appointment.scheduled_start) : null;
          return (
            <article
              key={appointment.id}
              className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white/80 p-4 text-sm text-gray-700 shadow-sm dark:border-gray-800 dark:bg-gray-950/70 dark:text-gray-200 sm:flex-row sm:items-center"
            >
              <div className="w-full sm:w-32">
                <p className="text-xs uppercase tracking-[0.4em] text-gray-500 dark:text-gray-400">{formatDate(appointment.scheduled_start)}</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatTime(appointment.scheduled_start)}</p>
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-[0.65rem] uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Session with BLACKWORKNYC</p>
                {appointment.assigned_admin ? (
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{appointment.assigned_admin.name}</p>
                ) : null}
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em]">
                  <Badge className={statusTone(appointment.status)}>{statusLabel(appointment.status)}</Badge>
                  {appointment.tattoo?.placement ? (
                    <span className="text-gray-500 dark:text-gray-400">{appointment.tattoo.placement.replace(/_/g, ' ')}</span>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em]">
                <Button variant="ghost" onClick={() => setSelectedAppointment(appointment)}>
                  View details
                </Button>
                {variant === 'upcoming' ? (
                  <>
                    <Button variant="ghost" onClick={() => handleActionClick('reschedule', appointment)}>
                      Reschedule
                    </Button>
                    <Button variant="ghost" onClick={() => handleActionClick('cancel', appointment)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" onClick={() => navigate('/share-your-idea')}>
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
        <SectionTitle eyebrow="Client portal" title="Appointments" description="Loading your schedule…" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="space-y-6">
        <SectionTitle eyebrow="Client portal" title="Appointments" description="We hit a snag." />
        <Card className="text-xs uppercase tracking-[0.3em] text-rose-600 dark:text-rose-300">{error}</Card>
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
      <SectionTitle eyebrow="Client portal" title="Appointments" description="A clean view of your schedule." />
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Appointments</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Manage your studio time with confidence.</p>
          </div>
          <Button as={Link} to="/share-your-idea">
            Book consult
          </Button>
        </div>
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} renderPanel={(tabId) => {
          if (tabId === 'upcoming') {
            return renderAppointmentList(upcomingAppointments, 'upcoming');
          }
          return renderAppointmentList(pastAppointments, 'past');
        }} />
      </Card>

      <Dialog
        open={!!actionDialog}
        onClose={() => setActionDialog(null)}
        title={actionDialog ? statusLabel(actionDialog.type) : 'Note'}
        footer={<Button onClick={() => setActionDialog(null)}>Close</Button>}
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">{buildActionMessage()}</p>
      </Dialog>

      <Dialog
        open={!!selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
        title="Appointment details"
        footer={<Button onClick={() => setSelectedAppointment(null)}>Close</Button>}
      >
        {selectedAppointment ? (
          <div className="space-y-3 text-sm text-gray-700 dark:text-gray-200">
            <p className="font-semibold text-gray-900 dark:text-gray-100">{formatDate(selectedAppointment.scheduled_start)} · {formatTime(selectedAppointment.scheduled_start)}</p>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Session with BLACKWORKNYC</p>
            {selectedAppointment.assigned_admin ? (
              <p>Artist: {selectedAppointment.assigned_admin.name}</p>
            ) : null}
            <p>Status: <span className={statusTone(selectedAppointment.status)}>{statusLabel(selectedAppointment.status)}</span></p>
            {selectedAppointment.tattoo?.notes ? <p>Notes: {selectedAppointment.tattoo.notes}</p> : null}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
