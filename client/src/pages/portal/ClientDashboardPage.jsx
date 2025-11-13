import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Badge from '../../components/Badge.jsx';
import Button from '../../components/Button.jsx';
import Card from '../../components/Card.jsx';
import Dialog from '../../components/Dialog.jsx';
import Lightbox from '../../components/Lightbox.jsx';
import SectionTitle from '../../components/SectionTitle.jsx';
import { apiPost, resolveApiUrl } from '../../lib/api.js';
import { useClientPortal } from '../../contexts/ClientPortalContext.jsx';

const PAST_STATUSES = new Set(['cancelled', 'cancelled_by_client', 'declined', 'completed', 'no_show']);

function formatSessionDate(value) {
  if (!value) {
    return '—';
  }
  try {
    return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}

function formatSessionTime(value) {
  if (!value) {
    return '—';
  }
  try {
    return new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function formatFriendlyDate(value) {
  if (!value) {
    return '—';
  }
  try {
    return new Date(value).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return '—';
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

export default function ClientDashboardPage() {
  const navigate = useNavigate();
  const notificationsRef = useRef(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [actionDialog, setActionDialog] = useState(null);
  const [ideaModalOpen, setIdeaModalOpen] = useState(false);
  const [ideaNotes, setIdeaNotes] = useState('');
  const [ideaSubmitting, setIdeaSubmitting] = useState(false);
  const [ideaStatus, setIdeaStatus] = useState(null);
  const [ideaError, setIdeaError] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  const { loading, error, profile, appointments, notifications, documents } = useClientPortal();

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

  const nextAppointment = upcomingAppointments[0] ?? null;

  const quickActions = useMemo(() => {
    const shareInspiration = () => {
      navigate('/portal/profile', { state: { focus: 'inspiration' } });
    };
    const shareIdea = () => {
      setIdeaModalOpen(true);
    };
    const viewDocuments = () => {
      navigate('/portal/profile', { state: { focus: 'documents' } });
    };
    const checkNotifications = () => {
      notificationsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    return [
      { label: 'Share Inspiration', description: 'Upload reference imagery before your next session.', action: shareInspiration },
      { label: 'Share an Idea', description: 'Send your concept to the studio quickly.', action: shareIdea },
      { label: 'View Documents', description: 'Review IDs, contracts, and studio files.', action: viewDocuments },
      { label: 'Check Notifications', description: 'Refresh your latest studio updates.', action: checkNotifications }
    ];
  }, [navigate, notificationsRef]);

  const recentUploads = useMemo(() => {
    if (!documents || !documents.length) {
      return [];
    }
    return documents.filter((doc) => doc.kind === 'inspiration' && doc.file_url).slice(0, 6);
  }, [documents]);

  const handleIdeaSubmit = async (event) => {
    event.preventDefault();
    if (!profile) {
      return;
    }
    if (!ideaNotes.trim()) {
      setIdeaError('Describe your idea before sending it.');
      return;
    }
    setIdeaSubmitting(true);
    setIdeaError(null);
    setIdeaStatus(null);

    try {
      await apiPost('/api/consultations', {
        name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.display_name,
        email: profile.email,
        phone: profile.phone,
        placement: 'client_portal',
        description: ideaNotes.trim(),
        preferred_date: null
      });
      setIdeaStatus('Idea shared with the studio. Expect a reply soon.');
      setIdeaNotes('');
    } catch (err) {
      setIdeaError(err?.message || 'Unable to send your idea right now.');
    } finally {
      setIdeaSubmitting(false);
    }
  };

  const handleViewDetails = (appointment) => {
    setSelectedAppointment(appointment);
  };

  const handleAction = (type, appointment) => {
    setActionDialog({ type, appointment });
  };

  const renderAppointmentCard = (appointment, variant) => {
    const start = appointment.scheduled_start ? new Date(appointment.scheduled_start) : null;
    const leftDate = start ? start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'TBD';
    const leftTime = start ? start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : 'TBD';
    return (
      <article
        key={appointment.id}
        className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white/80 p-4 text-sm text-gray-700 shadow-sm dark:border-gray-800 dark:bg-gray-950/70 dark:text-gray-200 sm:flex-row sm:items-center"
      >
        <div className="w-full sm:w-32">
          <p className="text-xs uppercase tracking-[0.4em] text-gray-500 dark:text-gray-400">{leftDate}</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{leftTime}</p>
        </div>
        <div className="flex-1 space-y-2">
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
          <Button variant="ghost" onClick={() => handleViewDetails(appointment)}>
            View details
          </Button>
          {variant === 'upcoming' ? (
            <>
              <Button variant="ghost" onClick={() => handleAction('reschedule', appointment)}>
                Reschedule
              </Button>
              <Button variant="ghost" onClick={() => handleAction('cancel', appointment)}>
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
  };

  const buildActionMessage = () => {
    if (!actionDialog) {
      return null;
    }
    const { type } = actionDialog;
    if (type === 'reschedule') {
      return 'Reschedule requests are handled by the studio. Reply to your confirmation email or drop us a DM for a time change.';
    }
    if (type === 'cancel') {
      return 'Need to cancel? Please let the studio know at least 48 hours before your session so we can release the slot.';
    }
    return null;
  };

  if (loading) {
    return (
      <main className="space-y-8">
        <SectionTitle eyebrow="Client portal" title="Dashboard" description="Loading your portal…" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="space-y-8">
        <SectionTitle eyebrow="Client portal" title="Dashboard" description="We hit a snag." />
        <Card className="text-xs uppercase tracking-[0.3em] text-rose-600 dark:text-rose-300">{error}</Card>
        <Button as={Link} to="/auth" variant="secondary">
          Return to sign in
        </Button>
      </main>
    );
  }

  const welcomeName = profile?.first_name || profile?.display_name || 'there';

  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="Client portal"
        title="Dashboard"
        description="Track appointments, upload inspiration, and stay updated with the studio."
      />

      <Card>
        <div className="grid gap-6 md:grid-cols-[1fr_280px] md:items-center">
          <div className="space-y-3">
            <p className="text-[0.6rem] uppercase tracking-[0.4em] text-gray-500 dark:text-gray-400">Welcome back, {welcomeName}</p>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Track appointments, share inspiration, and stay informed with ease.</h1>
          </div>
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/80 p-4 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-200">
            {nextAppointment ? (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.4em] text-gray-500 dark:text-gray-400">Next session</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {formatSessionDate(nextAppointment.scheduled_start)} · {formatSessionTime(nextAppointment.scheduled_start)}
                </p>
                <Button variant="ghost" onClick={() => handleViewDetails(nextAppointment)}>
                  View details
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.4em] text-gray-500 dark:text-gray-400">No upcoming sessions yet</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Book a consult to set up your next session.</p>
                <Button as={Link} to="/share-your-idea">
                  Book consult
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Upcoming appointment</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">All details are read-only here; toggle to edit via Profile.</p>
            </div>
            <Button as={Link} to="/portal/appointments" variant="ghost">
              View all
            </Button>
          </div>
          {nextAppointment ? (
            renderAppointmentCard(nextAppointment, 'upcoming')
          ) : (
            <div className="space-y-2 text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
              <p>You don’t have any upcoming sessions yet.</p>
              <Button as={Link} to="/share-your-idea" variant="ghost">
                Book consult
              </Button>
            </div>
          )}
        </Card>

        <Card ref={notificationsRef} className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Notifications</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Latest studio updates.</p>
            </div>
            <Button as={Link} to="/portal/profile" variant="ghost">
              View all
            </Button>
          </div>
          {notifications?.items?.length ? (
            <div className="space-y-3">
              {notifications.items.slice(0, 3).map((notification) => (
                <article key={notification.id} className="rounded-2xl border border-gray-200 bg-white/80 p-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-950/50 dark:text-gray-200">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{notification.title}</p>
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                    {new Date(notification.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </p>
                  <p className="mt-1 text-[0.75rem] text-gray-600 dark:text-gray-300">{notification.body}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">No studio updates yet.</p>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Quick actions</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Shortcuts to the features you use most often.</p>
          </div>
          <Button variant="ghost" onClick={() => navigate('/share-your-idea')}>
            Book consult
          </Button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {quickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.action}
              className="flex w-full items-center justify-between gap-2 rounded-full border border-gray-200 bg-gray-50/70 px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.3em] text-gray-700 transition hover:border-black hover:text-black dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-200 dark:hover:border-white"
            >
              <span>{action.label}</span>
              <span className="text-[0.6rem] text-gray-400 dark:text-gray-500">→</span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Recent uploads</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Tap to preview and share additional notes with the studio.</p>
          </div>
          <Button variant="ghost" onClick={() => navigate('/portal/profile', { state: { focus: 'inspiration' } })}>
            Upload inspiration
          </Button>
        </div>
        {recentUploads.length ? (
          <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
            {recentUploads.map((upload) => (
              <button
                key={upload.id}
                type="button"
                onClick={() => setPreviewImage(upload)}
                className="relative h-32 w-32 flex-shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-white text-left dark:border-gray-800"
              >
                <img
                  src={resolveApiUrl(upload.file_url)}
                  alt={upload.title}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-gray-900/80 to-transparent p-2 text-[0.6rem] uppercase tracking-[0.3em] text-white">
                  {new Date(upload.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">No inspiration uploads yet.</p>
        )}
      </Card>

      <Dialog open={ideaModalOpen} onClose={() => setIdeaModalOpen(false)} title="Share an idea" footer={
        <>
          <Button variant="ghost" onClick={() => setIdeaModalOpen(false)} disabled={ideaSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleIdeaSubmit} disabled={ideaSubmitting}>
            {ideaSubmitting ? 'Sending…' : 'Send to studio'}
          </Button>
        </>
      }>
        <p className="text-sm text-gray-600 dark:text-gray-400">Describe your concept or inspiration for your next session.</p>
        <textarea
          rows={4}
          value={ideaNotes}
          onChange={(event) => setIdeaNotes(event.target.value)}
          className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-black dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
        />
        {ideaError ? <p className="text-xs uppercase tracking-[0.3em] text-rose-600 dark:text-rose-300">{ideaError}</p> : null}
        {ideaStatus ? <p className="text-xs uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400">{ideaStatus}</p> : null}
      </Dialog>

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
            <p className="font-semibold text-gray-900 dark:text-gray-100">{formatFriendlyDate(selectedAppointment.scheduled_start)}</p>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Session with BLACKWORKNYC</p>
            {selectedAppointment.assigned_admin ? (
              <p>Artist: {selectedAppointment.assigned_admin.name}</p>
            ) : null}
            <p>Status: <span className={statusTone(selectedAppointment.status)}>{statusLabel(selectedAppointment.status)}</span></p>
            {selectedAppointment.tattoo?.notes ? <p>Notes: {selectedAppointment.tattoo.notes}</p> : null}
          </div>
        ) : null}
      </Dialog>

      <Lightbox open={!!previewImage} image={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  );
}
