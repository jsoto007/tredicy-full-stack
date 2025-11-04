import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../../components/Button.jsx';
import Card from '../../components/Card.jsx';
import FadeIn from '../../components/FadeIn.jsx';
import SectionTitle from '../../components/SectionTitle.jsx';
import { apiGet, resolveApiUrl } from '../../lib/api.js';
import { ASSET_KIND_OPTIONS, useAdminDashboard } from './AdminDashboardContext.jsx';

const INITIAL_ASSET_DRAFT = {
  kind: 'note',
  file_url: '',
  note_text: '',
  is_visible_to_client: false
};

const ASSET_FIELD_IDS = {
  kind: 'appointment-asset-kind',
  share: 'appointment-asset-share',
  fileUrl: 'appointment-asset-file-url',
  note: 'appointment-asset-note'
};

function formatDateTime(value) {
  if (!value) {
    return 'Not scheduled';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Not scheduled';
  }
  return date.toLocaleString();
}

function isImageUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  const sanitized = url.split('?')[0]?.split('#')[0] ?? '';
  return /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(sanitized);
}

export default function AppointmentDetails() {
  const { appointmentId } = useParams();
  const appointmentNumericId = Number(appointmentId);
  const navigate = useNavigate();

  const {
    state: { appointments, currentAdmin },
    actions: { setFeedback, createAppointmentAsset, toggleAppointmentAssetVisibility, refreshAppointments }
  } = useAdminDashboard();

  const [appointment, setAppointment] = useState(() =>
    appointments.find((entry) => entry.id === appointmentNumericId) || null
  );
  const [loading, setLoading] = useState(!appointment);
  const [error, setError] = useState(null);
  const [assetDraft, setAssetDraft] = useState(INITIAL_ASSET_DRAFT);
  const [busyAssetId, setBusyAssetId] = useState(null);

  const reloadAppointment = useCallback(async () => {
    if (!appointmentNumericId) {
      return;
    }
    setLoading(true);
    try {
      const response = await apiGet(`/api/admin/appointments/${appointmentNumericId}`);
      setAppointment(response);
      setError(null);
    } catch (err) {
      setError('Unable to load appointment details.');
    } finally {
      setLoading(false);
    }
  }, [appointmentNumericId]);

  useEffect(() => {
    reloadAppointment();
  }, [reloadAppointment]);

  useEffect(() => {
    const fresh = appointments.find((entry) => entry.id === appointmentNumericId);
    if (fresh) {
      setAppointment(fresh);
    }
  }, [appointments, appointmentNumericId]);

  const assetOptions = useMemo(() => ASSET_KIND_OPTIONS, []);

  const handleAssetDraftChange = (field, value) => {
    setAssetDraft((prev) => ({
      ...prev,
      [field]: field === 'is_visible_to_client' ? Boolean(value) : value
    }));
  };

  const handleAssetSubmit = async (event) => {
    event.preventDefault();
    if (!appointment) {
      return;
    }
    if (!assetDraft.kind) {
      setFeedback({ tone: 'offline', message: 'Select an asset type.' });
      return;
    }
    if (!assetDraft.file_url.trim() && !assetDraft.note_text.trim()) {
      setFeedback({ tone: 'offline', message: 'Provide a file URL or note text.' });
      return;
    }
    setBusyAssetId('new');
    try {
      await createAppointmentAsset(appointment.id, {
        kind: assetDraft.kind,
        file_url: assetDraft.file_url.trim() || null,
        note_text: assetDraft.note_text.trim() || null,
        is_visible_to_client: assetDraft.is_visible_to_client,
        uploaded_by_admin_id: currentAdmin?.id
      });
      await Promise.all([refreshAppointments(), reloadAppointment()]);
      setAssetDraft((prev) => ({
        ...INITIAL_ASSET_DRAFT,
        kind: prev.kind,
        is_visible_to_client: prev.is_visible_to_client
      }));
    } catch (err) {
      setFeedback({ tone: 'offline', message: 'Unable to add asset.' });
    } finally {
      setBusyAssetId(null);
    }
  };

  const handleAssetVisibilityToggle = async (asset) => {
    if (!appointment) {
      return;
    }
    setBusyAssetId(asset.id);
    try {
      await toggleAppointmentAssetVisibility(appointment.id, asset.id, !asset.is_visible_to_client);
      await Promise.all([refreshAppointments(), reloadAppointment()]);
    } catch {
      setFeedback({ tone: 'offline', message: 'Unable to update asset visibility.' });
    } finally {
      setBusyAssetId(null);
    }
  };

  if (!appointmentNumericId || Number.isNaN(appointmentNumericId)) {
    return (
      <main className="bg-gray-50 py-16 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <div className="mx-auto max-w-5xl px-1 sm:px-1">
          <p className="text-sm text-red-500">Invalid appointment identifier.</p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="bg-gray-50 py-16 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <div className="mx-auto max-w-5xl space-y-4 px-4 sm:px-6">
          <SectionTitle eyebrow="Admin" title="Appointment details" description="Loading appointment information..." />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="bg-gray-50 py-16 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6">
          <SectionTitle eyebrow="Admin" title="Appointment details" description="Something went wrong." />
          <p className="text-sm text-red-500">{error}</p>
          <Button type="button" onClick={() => navigate('/dashboard/admin/calendar')}>
            Back to calendar
          </Button>
        </div>
      </main>
    );
  }

  if (!appointment) {
    return (
      <main className="bg-gray-50 py-16 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6">
          <SectionTitle eyebrow="Admin" title="Appointment details" description="Appointment not found." />
          <Button type="button" onClick={() => navigate('/dashboard/admin/calendar')}>
            Back to calendar
          </Button>
        </div>
      </main>
    );
  }

  const client = appointment.client || {
    display_name: appointment.guest_name || 'Guest',
    email: appointment.guest_email,
    phone: appointment.guest_phone
  };

  return (
    <main className="bg-gray-50 py-16 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <FadeIn as="div" className="mx-auto max-w-5xl space-y-8 px-4 sm:px-6" childClassName="w-full">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <SectionTitle
            eyebrow="Admin"
            title={`Appointment ${appointment.reference_code || `#${appointment.id}`}`}
            description="Review client information, assets, and admin-only notes."
          />
          <Button type="button" variant="secondary" onClick={() => navigate('/dashboard/admin/calendar')}>
            Back to calendar
          </Button>
        </div>

        <Card className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
            Appointment overview
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Status</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{appointment.status}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Scheduled start</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{formatDateTime(appointment.scheduled_start)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Duration</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">
                {appointment.duration_minutes ? `${appointment.duration_minutes} minutes` : 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Assigned admin</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">
                {appointment.assigned_admin?.name || 'Unassigned'}
              </p>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Client notes</p>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              {appointment.client_description || 'No notes from client.'}
            </p>
          </div>
        </Card>

        <Card className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
            Client profile
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Name</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{client.display_name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Email</p>
              <p className="text-sm text-gray-800 underline dark:text-gray-200">
                {client.email ? (
                  <a href={`mailto:${client.email}`} className="hover:text-gray-900 dark:hover:text-gray-100">
                    {client.email}
                  </a>
                ) : (
                  'Not provided'
                )}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Phone</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{client.phone || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Account type</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">
                {appointment.client ? appointment.client.role : 'Guest'}
              </p>
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                Assets
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Upload admin notes or share reference material with the client.
              </p>
            </div>
            <span className="text-xs uppercase tracking-[0.3em] text-gray-400 dark:text-gray-500">
              {appointment.assets?.length || 0} attached
            </span>
          </div>
          <form onSubmit={handleAssetSubmit} className="grid gap-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800 dark:bg-gray-950">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label
                  htmlFor={ASSET_FIELD_IDS.kind}
                  className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
                >
                  Type
                </label>
                <select
                  id={ASSET_FIELD_IDS.kind}
                  value={assetDraft.kind}
                  onChange={(event) => handleAssetDraftChange('kind', event.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-gray-400"
                >
                  {assetOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                  Share with client
                </span>
                <div className="mt-2 inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                  <input
                    id={ASSET_FIELD_IDS.share}
                    type="checkbox"
                    checked={assetDraft.is_visible_to_client}
                    onChange={(event) => handleAssetDraftChange('is_visible_to_client', event.target.checked)}
                    className="h-4 w-4 rounded border border-gray-400 text-gray-900 focus:ring-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:focus:ring-gray-400"
                  />
                  <label htmlFor={ASSET_FIELD_IDS.share}>Visible</label>
                </div>
              </div>
            </div>
            <label
              htmlFor={ASSET_FIELD_IDS.fileUrl}
              className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
            >
              File URL
            </label>
            <input
              id={ASSET_FIELD_IDS.fileUrl}
              type="url"
              placeholder="File URL (optional)"
              value={assetDraft.file_url}
              onChange={(event) => handleAssetDraftChange('file_url', event.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
            />
            <label
              htmlFor={ASSET_FIELD_IDS.note}
              className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
            >
              Note text
            </label>
            <textarea
              id={ASSET_FIELD_IDS.note}
              rows={2}
              placeholder="Note text (optional)"
              value={assetDraft.note_text}
              onChange={(event) => handleAssetDraftChange('note_text', event.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
            />
            <div>
              <Button type="submit" disabled={busyAssetId === 'new'}>
                Attach asset
              </Button>
            </div>
          </form>
          <div className="space-y-3">
            {appointment.assets?.map((asset) => {
              const fileUrl = resolveApiUrl(asset.file_url);
              const showPreview = fileUrl && (asset.kind === 'inspiration_image' || isImageUrl(fileUrl));
              const kindLabel = asset.kind ? asset.kind.replace(/_/g, ' ') : 'Asset';
              return (
                <div
                  key={asset.id}
                  className="rounded-xl border border-gray-200 p-4 dark:border-gray-800 dark:bg-gray-950"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex flex-1 flex-wrap items-start gap-4">
                      {showPreview ? (
                        <figure className="group relative flex-shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-900">
                          <img
                            src={fileUrl}
                            alt={`${kindLabel} preview`}
                            className="h-32 w-32 object-cover transition duration-300 group-hover:scale-[1.02]"
                          />
                        </figure>
                      ) : null}
                      <div className="min-w-[200px] space-y-2">
                        <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                          {kindLabel}
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {asset.note_text || asset.file_url || 'No content'}
                        </p>
                        {fileUrl && !showPreview ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400 break-all">{fileUrl}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3 sm:flex-row sm:items-center">
                      {fileUrl ? (
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs uppercase tracking-[0.3em] text-gray-500 underline hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                        >
                          Open
                        </a>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleAssetVisibilityToggle(asset)}
                        disabled={busyAssetId === asset.id}
                      >
                        {asset.is_visible_to_client ? 'Hide from client' : 'Share with client'}
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] uppercase tracking-[0.25em] text-gray-400 dark:text-gray-500">
                    Uploaded by {asset.uploaded_by_admin?.name || asset.uploaded_by_client?.display_name || 'unknown'} ·{' '}
                    {asset.created_at ? new Date(asset.created_at).toLocaleString() : ''}
                  </p>
                </div>
              );
            })}
            {!appointment.assets?.length ? (
              <div className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                No assets linked to this appointment yet.
              </div>
            ) : null}
          </div>
        </Card>
      </FadeIn>
    </main>
  );
}
