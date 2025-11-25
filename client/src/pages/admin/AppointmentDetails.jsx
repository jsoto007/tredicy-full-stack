import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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
  fileUpload: 'appointment-asset-file-upload',
  note: 'appointment-asset-note'
};

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' }
];

const APPOINTMENT_STATUS_FIELD_ID = 'appointment-status-select';
const ICON_BADGE_CLASS =
  'flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-black/10 dark:from-gray-100 dark:via-gray-200 dark:to-gray-400 dark:text-gray-900 dark:ring-white/15';

function formatStatusLabel(value) {
  if (!value) {
    return '';
  }
  return value
    .split(/[_\s]+/)
    .map((segment) => (segment ? segment[0].toUpperCase() + segment.slice(1) : ''))
    .join(' ');
}

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

function formatDuration(minutes) {
  if (!minutes) {
    return 'Not set';
  }
  const hours = minutes / 60;
  if (Number.isInteger(hours)) {
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  return `${minutes} minutes`;
}

function isImageUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  const sanitized = url.split('?')[0]?.split('#')[0] ?? '';
  return /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(sanitized);
}

function getFileExtension(url) {
  if (!url || typeof url !== 'string') {
    return '';
  }
  const sanitized = url.split('?')[0]?.split('#')[0] ?? '';
  const segments = sanitized.split('.');
  if (segments.length < 2) {
    return '';
  }
  return segments.pop()?.toLowerCase() || '';
}

function isPdfUrl(url) {
  return getFileExtension(url) === 'pdf';
}


function getErrorMessage(error, fallback = 'Something went wrong.') {
  if (!error) {
    return fallback;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }
  if (typeof error.error === 'string' && error.error.trim()) {
    return error.error;
  }
  return fallback;
}

function IconMail(props) {
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
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="M4 8l8 5 8-5" />
    </svg>
  );
}

function IconPhone(props) {
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
      <path d="M7 4.5h3l2 4-2 1.5a11.5 11.5 0 0 0 4 4l1.5-2 4 2v3a2 2 0 0 1-2.2 2 15 15 0 0 1-12.3-12A2 2 0 0 1 7 4.5z" />
    </svg>
  );
}

function IconLink(props) {
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
      <path d="M9 7H7a4 4 0 0 0 0 8h2" />
      <path d="M15 7h2a4 4 0 0 1 0 8h-2" />
      <path d="M9 12h6" />
    </svg>
  );
}

function IconShield(props) {
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
      <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z" />
      <path d="m9.5 12.5 2 2 3-4" />
    </svg>
  );
}

export default function AppointmentDetails() {
  const { appointmentId } = useParams();
  const appointmentNumericId = Number(appointmentId);
  const navigate = useNavigate();
  const location = useLocation();

  const {
    state: { appointments, currentAdmin },
    actions: {
      setFeedback,
      createAppointmentAsset,
      toggleAppointmentAssetVisibility,
      uploadMedia,
      updateAppointment
    }
  } = useAdminDashboard();

  const [appointment, setAppointment] = useState(() =>
    appointments.find((entry) => entry.id === appointmentNumericId) || null
  );
  const [loading, setLoading] = useState(!appointment);
  const [error, setError] = useState(null);
  const [assetDraft, setAssetDraft] = useState(INITIAL_ASSET_DRAFT);
  const [busyAssetId, setBusyAssetId] = useState(null);
  const [assetUploadFile, setAssetUploadFile] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusUpdateError, setStatusUpdateError] = useState(null);
  const imageInputRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const [activePreviewAssetId, setActivePreviewAssetId] = useState(null);
  const appointmentDetailPath = useMemo(
    () => `/dashboard/admin/calendar/${appointment?.id || appointmentNumericId || ''}`,
    [appointment?.id, appointmentNumericId]
  );

  const reloadAppointment = useCallback(async ({ showLoader = false } = {}) => {
    if (!appointmentNumericId) {
      return;
    }
    if (showLoader) {
      setLoading(true);
    }
    try {
      const response = await apiGet(`/api/admin/appointments/${appointmentNumericId}`);
      setAppointment(response);
      setError(null);
    } catch (err) {
      setError('Unable to load appointment details.');
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [appointmentNumericId]);

  useEffect(() => {
    if (!appointment) {
      reloadAppointment({ showLoader: true });
    }
  }, [appointment, reloadAppointment]);

  useEffect(() => {
    const fresh = appointments.find((entry) => entry.id === appointmentNumericId);
    if (fresh) {
      setAppointment(fresh);
    }
  }, [appointments, appointmentNumericId]);

  const assetOptions = useMemo(() => ASSET_KIND_OPTIONS, []);
  const imageAssets = useMemo(() => {
    if (!appointment || !Array.isArray(appointment.assets)) {
      return [];
    }
    return appointment.assets.filter((asset) => {
      if (!asset?.file_url) {
        return false;
      }
      return ['id_front', 'id_back', 'inspiration_image'].includes(asset.kind);
    });
  }, [appointment]);
  const previewableAssets = useMemo(() => {
    if (!appointment?.assets?.length) {
      return [];
    }
    return appointment.assets
      .map((asset) => ({
        ...asset,
        resolvedUrl: resolveApiUrl(asset.file_url)
      }))
      .filter((asset) => Boolean(asset.resolvedUrl));
  }, [appointment]);
  const appointmentStatusOptions = useMemo(() => {
    const options = [...STATUS_OPTIONS];
    const currentStatus = appointment?.status;
    if (currentStatus && !options.some((entry) => entry.value === currentStatus)) {
      options.push({ value: currentStatus, label: formatStatusLabel(currentStatus) });
    }
    return options;
  }, [appointment?.status]);

  const handleAssetDraftChange = (field, value) => {
    setAssetDraft((prev) => ({
      ...prev,
      [field]: field === 'is_visible_to_client' ? Boolean(value) : value
    }));
  };

  const handleAssetFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setAssetUploadFile(file);
  };

  const resetAssetForm = () => {
    setAssetDraft(INITIAL_ASSET_DRAFT);
    setAssetUploadFile(null);
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = '';
    }
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
    const trimmedUrl = assetDraft.file_url.trim();
    const trimmedNote = assetDraft.note_text.trim();
    const hasFile = Boolean(assetUploadFile);
    if (!trimmedUrl && !trimmedNote && !hasFile) {
      setFeedback({ tone: 'offline', message: 'Attach a file, upload, or provide a note.' });
      return;
    }
    setBusyAssetId('new');
    try {
      let uploadedUrl = trimmedUrl || '';
      if (hasFile) {
        const upload = await uploadMedia(assetUploadFile);
        if (!upload?.url) {
          throw new Error('Upload failed.');
        }
        uploadedUrl = upload.url;
      }
      await createAppointmentAsset(appointment.id, {
        kind: assetDraft.kind,
        file_url: uploadedUrl || null,
        note_text: trimmedNote || null,
        is_visible_to_client: assetDraft.is_visible_to_client,
        uploaded_by_admin_id: currentAdmin?.id
      });
      resetAssetForm();
    } catch (err) {
      setFeedback({ tone: 'offline', message: getErrorMessage(err, 'Unable to add asset.') });
    } finally {
      setBusyAssetId(null);
    }
  };

  const handleAssetVisibilityToggle = async (asset) => {
    if (!appointment) {
      return;
    }
    const nextVisibility = !asset.is_visible_to_client;
    setBusyAssetId(asset.id);
    try {
      await toggleAppointmentAssetVisibility(appointment.id, asset.id, nextVisibility);
      setAppointment((prev) => {
        if (!prev || !Array.isArray(prev.assets)) {
          return prev;
        }
        return {
          ...prev,
          assets: prev.assets.map((entry) =>
            entry.id === asset.id ? { ...entry, is_visible_to_client: nextVisibility } : entry
          )
        };
      });
    } catch {
      setFeedback({ tone: 'offline', message: 'Unable to update asset visibility.' });
    } finally {
      setBusyAssetId(null);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const assetIdParam = params.get('assetId');
    if (!assetIdParam) {
      setActivePreviewAssetId(null);
      return;
    }
    const match = previewableAssets.find((asset) => String(asset.id) === String(assetIdParam));
    if (match) {
      setActivePreviewAssetId(match.id);
    }
  }, [location.search, previewableAssets]);

  const selectedPreviewAsset = useMemo(() => {
    if (!activePreviewAssetId || !previewableAssets.length) {
      return null;
    }
    return previewableAssets.find((asset) => String(asset.id) === String(activePreviewAssetId)) || previewableAssets[0];
  }, [activePreviewAssetId, previewableAssets]);

  const updatePreviewUrl = useCallback(
    (assetId) => {
      if (!appointmentDetailPath) {
        return;
      }
      const search = assetId ? `?assetId=${assetId}` : '';
      navigate(`${appointmentDetailPath}${search}`, { replace: true });
    },
    [appointmentDetailPath, navigate]
  );

  const handleOpenPreview = (assetId) => {
    if (!previewableAssets.length) {
      return;
    }
    const match = previewableAssets.find((asset) => String(asset.id) === String(assetId));
    const targetId = (match || previewableAssets[0]).id;
    setActivePreviewAssetId(targetId);
    updatePreviewUrl(targetId);
  };

  const handleClosePreview = () => {
    setActivePreviewAssetId(null);
    updatePreviewUrl(null);
  };

  const handlePreviewNav = (direction) => {
    if (!selectedPreviewAsset || !previewableAssets.length) {
      return;
    }
    const currentIndex = previewableAssets.findIndex((asset) => asset.id === selectedPreviewAsset.id);
    if (currentIndex === -1) {
      return;
    }
    const nextIndex =
      direction === 'next'
        ? (currentIndex + 1) % previewableAssets.length
        : (currentIndex - 1 + previewableAssets.length) % previewableAssets.length;
    const nextId = previewableAssets[nextIndex].id;
    setActivePreviewAssetId(nextId);
    updatePreviewUrl(nextId);
  };

  const handleTriggerImageUpload = () => {
    imageInputRef.current?.click();
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!appointment || !file) {
      return;
    }

    setUploadingImage(true);
    try {
      const upload = await uploadMedia(file);
      if (!upload?.url) {
        throw new Error('Upload failed.');
      }
      await createAppointmentAsset(appointment.id, {
        kind: 'inspiration_image',
        file_url: upload.url,
        note_text: null,
        is_visible_to_client: true,
        uploaded_by_admin_id: currentAdmin?.id
      });
    } catch (err) {
      setFeedback({ tone: 'error', message: getErrorMessage(err, 'Unable to upload image.') });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleStatusChange = async (event) => {
    if (!appointment) {
      return;
    }
    const newStatus = event.target.value;
    if (!newStatus || newStatus === appointment.status) {
      return;
    }
    setStatusUpdateError(null);
    setStatusUpdating(true);
    try {
      await updateAppointment(appointment.id, { status: newStatus });
      setAppointment((prev) => (prev ? { ...prev, status: newStatus } : prev));
    } catch (err) {
      setStatusUpdateError(getErrorMessage(err, 'Unable to update status.'));
    } finally {
      setStatusUpdating(false);
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
  const contact = appointment.contact || {
    name: appointment.contact_name || client.display_name,
    email: appointment.contact_email || client.email,
    phone: appointment.contact_phone || client.phone
  };

  const appointmentTitle = appointment.reference_code || `#${appointment.id}`;
  const statusBadgeLabel = formatStatusLabel(appointment.status) || 'Pending';

  return (
    <main className="bg-gray-100 py-14 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <FadeIn as="div" className="mx-auto max-w-6xl space-y-8 px-4 sm:px-6" childClassName="w-full">
        <div className="flex flex-col justify-between gap-4 rounded-3xl bg-white/80 p-6 shadow-soft ring-1 ring-gray-200 backdrop-blur-md dark:bg-gray-900/80 dark:ring-gray-800 sm:flex-row sm:items-center">
          <div className="space-y-3">
            <span className="inline-flex items-center rounded-full bg-gray-200 px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-gray-700 dark:bg-gray-800 dark:text-gray-200">
              Signed in as {currentAdmin?.name || 'Admin'}
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500 dark:text-gray-400">Appointment</p>
              <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-gray-50">{appointmentTitle}</h1>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Review client information, assets, and admin-only notes.
              </p>
            </div>
          </div>
          <Button type="button" variant="secondary" onClick={() => navigate('/dashboard/admin/calendar')}>
            ← Back to calendar
          </Button>
        </div>

        <Card className="space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Appointment overview</p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                  {statusBadgeLabel}
                </span>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-gray-500 dark:text-gray-400">
                  <span>Update status</span>
                  <select
                    id={APPOINTMENT_STATUS_FIELD_ID}
                    value={appointment.status || STATUS_OPTIONS[0].value}
                    onChange={handleStatusChange}
                    disabled={statusUpdating}
                    className="rounded-full border border-gray-200 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-800 transition focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-gray-400"
                  >
                    {appointmentStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {statusUpdating ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">Saving status...</p>
              ) : null}
              {statusUpdateError ? (
                <p className="text-xs text-red-500 dark:text-red-400">{statusUpdateError}</p>
              ) : null}
            </div>
            <div className="grid w-full gap-4 sm:grid-cols-2 md:max-w-xl">
              <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/60">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Scheduled start</p>
                <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-100">{formatDateTime(appointment.scheduled_start)}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/60">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Duration</p>
                <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-100">{formatDuration(appointment.duration_minutes)}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/60">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Suggested duration</p>
                <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {formatDuration(appointment.suggested_duration_minutes)}
                </p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/60">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Assigned admin</p>
                <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {appointment.assigned_admin?.name || 'Unassigned'}
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/60">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Tattoo placement</p>
              <p className="mt-1 text-sm text-gray-800 dark:text-gray-200">
                {appointment.tattoo?.placement || appointment.tattoo_placement || 'Not provided'}
              </p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/60">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Approximate size</p>
              <p className="mt-1 text-sm text-gray-800 dark:text-gray-200">
                {appointment.tattoo?.size || appointment.tattoo_size || 'Not provided'}
              </p>
            </div>
            <div className="md:col-span-2 rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/60">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Placement notes</p>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                {appointment.tattoo?.notes || appointment.placement_notes || 'No placement notes.'}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border-l-4 border-amber-400 bg-amber-50 px-4 py-3 dark:border-amber-500 dark:bg-amber-900/20">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-700 dark:text-amber-200">Client notes</p>
            <p className="mt-1 text-sm text-amber-900 dark:text-amber-100">{appointment.client_description || 'No notes from client.'}</p>
          </div>
        </Card>

        <Card className="space-y-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Contact & account</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-4 rounded-2xl bg-gray-50 p-4 transition hover:-translate-y-[1px] hover:shadow-sm dark:bg-gray-900/60">
              <div className={`${ICON_BADGE_CLASS} text-[11px] font-black uppercase tracking-[0.25em]`}>
                {contact.name?.slice(0, 2).toUpperCase() || 'CT'}
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Primary contact</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{contact.name || 'Not provided'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl bg-gray-50 p-4 transition hover:-translate-y-[1px] hover:shadow-sm dark:bg-gray-900/60">
              <div className={`${ICON_BADGE_CLASS} bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700`}>
                <IconMail className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Contact email</p>
                <p className="text-sm font-semibold text-gray-900 underline decoration-dashed decoration-gray-400 dark:text-gray-100">
                  {contact.email ? (
                    <a href={`mailto:${contact.email}`} className="hover:text-gray-700 dark:hover:text-gray-200">
                      {contact.email}
                    </a>
                  ) : (
                    'Not provided'
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl bg-gray-50 p-4 transition hover:-translate-y-[1px] hover:shadow-sm dark:bg-gray-900/60">
              <div className={`${ICON_BADGE_CLASS} bg-gradient-to-br from-gray-900 via-gray-800 to-gray-800`}>
                <IconPhone className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Contact phone</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{contact.phone || 'Not provided'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl bg-gray-50 p-4 transition hover:-translate-y-[1px] hover:shadow-sm dark:bg-gray-900/60">
              <div className={`${ICON_BADGE_CLASS} bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800`}>
                <IconLink className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Linked account</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{client.display_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl bg-gray-50 p-4 transition hover:-translate-y-[1px] hover:shadow-sm dark:bg-gray-900/60">
              <div className={ICON_BADGE_CLASS}>
                <IconMail className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Account email</p>
                <p className="text-sm font-semibold text-gray-900 underline decoration-dashed decoration-gray-400 dark:text-gray-100">
                  {client.email ? (
                    <a href={`mailto:${client.email}`} className="hover:text-gray-700 dark:hover:text-gray-200">
                      {client.email}
                    </a>
                  ) : (
                    'Guest booking'
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl bg-gray-50 p-4 transition hover:-translate-y-[1px] hover:shadow-sm dark:bg-gray-900/60">
              <div className={`${ICON_BADGE_CLASS} bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800`}>
                <IconShield className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Account type</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{appointment.client ? appointment.client.role : 'Guest'}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="space-y-5">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleImageUpload}
          />
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white/70 p-4 shadow-sm ring-1 ring-gray-50 dark:border-gray-800 dark:bg-gray-900/60 dark:ring-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-gray-500 dark:text-gray-400">Assets</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Upload admin notes or share reference material with the client.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Button
                type="button"
                variant="primary"
                onClick={handleTriggerImageUpload}
                disabled={uploadingImage}
                className="shadow-[0_12px_30px_rgba(79,70,229,0.25)]"
              >
                {uploadingImage ? 'Uploading…' : 'Upload Photo'}
              </Button>
              <span className="rounded-full bg-gray-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-white dark:bg-white dark:text-gray-900">
                {(appointment.assets?.length || 0).toString().padStart(2, '0')} Attached
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-600 dark:text-gray-400">Client Photos</h4>
            {imageAssets.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {imageAssets.map((asset, index) => {
                  const backgroundImage = resolveApiUrl(asset.file_url);
                  return (
                    <button
                      type="button"
                      key={`preview-${asset.id}`}
                      onClick={() => handleOpenPreview(asset.id)}
                      className="group relative overflow-hidden rounded-2xl bg-gradient-to-br shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div
                        className="flex h-40 w-full items-end justify-between bg-black/10 px-4 py-2.5 text-left text-white"
                      >
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.25em] opacity-80">Photo</p>
                          <p className="text-lg font-bold">{`Photo ${index + 1}`}</p>
                        </div>
                        <span className="rounded-full bg-white/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-white">
                          {asset.uploaded_by_client ? 'Client' : 'Admin'}
                        </span>
                      </div>
                      <div className="relative h-32 w-full overflow-hidden bg-gray-100 dark:bg-gray-900">
                        <img
                          src={backgroundImage}
                          alt={`${asset.kind || 'Client asset'} preview`}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white/60 px-4 py-5 text-center text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
                No client photos uploaded yet.
              </div>
            )}
          </div>

          <form
            onSubmit={handleAssetSubmit}
            className="grid gap-4 rounded-2xl border border-gray-100 bg-white/80 p-4 shadow-sm ring-1 ring-gray-50 dark:border-gray-800/80 dark:bg-gray-900/70"
          >
            <input
              ref={attachmentInputRef}
              id={ASSET_FIELD_IDS.fileUpload}
              type="file"
              className="sr-only"
              onChange={handleAssetFileChange}
              accept=".pdf,.doc,.docx,.txt,.zip,.rar,.png,.jpg,.jpeg,.webp,.heic,.svg,.gif"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor={ASSET_FIELD_IDS.kind}
                  className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
                >
                  Type
                </label>
                <select
                  id={ASSET_FIELD_IDS.kind}
                  value={assetDraft.kind}
                  onChange={(event) => handleAssetDraftChange('kind', event.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-inner focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20"
                >
                  {assetOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                  Share with client (visible)
                </span>
                <div className="inline-flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs uppercase tracking-[0.3em] text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  <input
                    id={ASSET_FIELD_IDS.share}
                    type="checkbox"
                    checked={assetDraft.is_visible_to_client}
                    onChange={(event) => handleAssetDraftChange('is_visible_to_client', event.target.checked)}
                    className="h-4 w-4 rounded border border-gray-400 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900"
                  />
                  <label htmlFor={ASSET_FIELD_IDS.share}>Share with client</label>
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 md:items-end">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Attach File</p>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2 shadow-inner dark:bg-gray-900">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">File</p>
                    <p className="text-[11px] text-gray-600 dark:text-gray-300">
                      {assetUploadFile ? assetUploadFile.name : 'No file selected'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => attachmentInputRef.current?.click()}
                    disabled={busyAssetId === 'new'}
                  >
                    {assetUploadFile ? 'Change file' : 'Choose file'}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor={ASSET_FIELD_IDS.fileUrl}
                  className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
                >
                  File URL (optional)
                </label>
                <input
                  id={ASSET_FIELD_IDS.fileUrl}
                  type="url"
                  placeholder="https://example.com/file.png"
                  value={assetDraft.file_url}
                  onChange={(event) => handleAssetDraftChange('file_url', event.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-inner focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label
                htmlFor={ASSET_FIELD_IDS.note}
                className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
              >
                Note (optional)
              </label>
              <textarea
                id={ASSET_FIELD_IDS.note}
                rows={3}
                placeholder="Add note text"
                value={assetDraft.note_text}
                onChange={(event) => handleAssetDraftChange('note_text', event.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-inner focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400 dark:text-gray-500">
                Share with client (visible)
              </span>
              <Button type="submit" disabled={busyAssetId === 'new'}>
                Attach asset
              </Button>
            </div>
          </form>
          <div className="space-y-3">
            {appointment.assets?.map((asset) => {
              const fileUrl = resolveApiUrl(asset.file_url);
              const extension = getFileExtension(fileUrl);
              const isImagePreview = fileUrl && (asset.kind === 'inspiration_image' || isImageUrl(fileUrl));
              const isPdfPreview = fileUrl && isPdfUrl(fileUrl);
              const hasFile = Boolean(fileUrl);
              const kindLabel = asset.kind ? asset.kind.replace(/_/g, ' ') : 'Asset';
              const isNote = asset.kind === 'note';
              const badgeClass = isNote
                ? 'bg-purple-100 text-purple-700'
                : 'bg-sky-100 text-sky-700';
              const tagClass = asset.is_visible_to_client
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700';
              const description = asset.note_text || (hasFile ? 'File attached' : 'No note added');
              return (
                <div
                  key={asset.id}
                  className="rounded-2xl border border-gray-100 bg-white/80 p-4 shadow-sm ring-1 ring-gray-50 transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800/80 dark:bg-gray-900/70"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex flex-1 flex-wrap items-start gap-4">
                      {hasFile ? (
                        <button
                          type="button"
                          onClick={() => handleOpenPreview(asset.id)}
                          className="group relative flex-shrink-0 overflow-hidden rounded-2xl border border-gray-100 bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-gray-700/80 dark:bg-gray-900"
                          aria-label={`Open ${kindLabel} viewer`}
                        >
                          {isImagePreview ? (
                            <img
                              src={fileUrl}
                              alt={`${kindLabel} preview`}
                              className="h-32 w-32 object-cover transition duration-300 group-hover:scale-[1.02]"
                            />
                          ) : (
                            <div className="flex h-32 w-32 flex-col items-center justify-center gap-1 bg-gray-50 text-gray-700 transition group-hover:bg-gray-100 dark:bg-gray-950 dark:text-gray-200 dark:group-hover:bg-gray-900">
                              <span className="text-xs font-semibold uppercase">{extension || 'Doc'}</span>
                              <span className="text-[11px] uppercase tracking-[0.25em] text-gray-500 dark:text-gray-400">
                                Preview
                              </span>
                            </div>
                          )}
                          <span
                            aria-hidden="true"
                            className="absolute inset-0 ring-1 ring-inset ring-gray-900/5 transition group-hover:ring-indigo-200 dark:ring-gray-50/5"
                          />
                        </button>
                      ) : null}
                      <div className="min-w-[240px] space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] ${badgeClass}`}>
                            {kindLabel}
                          </span>
                          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] ${tagClass}`}>
                            {asset.is_visible_to_client ? 'Visible to Client' : 'Admin Only'}
                          </span>
                          {asset.uploaded_by_client ? (
                            <span className="rounded-full bg-gray-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-white dark:bg-gray-100 dark:text-gray-900">
                              Client Upload
                            </span>
                          ) : null}
                        </div>
                        <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{description}</p>
                        {hasFile ? (
                          <p className="text-sm text-gray-600 dark:text-gray-300">{isImagePreview ? 'Image attached' : isPdfPreview ? 'PDF attached' : `${extension?.toUpperCase() || 'FILE'} attached`}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3 sm:flex-row sm:items-center">
                      {fileUrl ? (
                        <Button as="a" href={fileUrl} target="_blank" rel="noreferrer" variant="secondary">
                          Open
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleAssetVisibilityToggle(asset)}
                        disabled={busyAssetId === asset.id}
                      >
                        {asset.is_visible_to_client ? 'Hide from Client' : 'Share with Client'}
                      </Button>
                    </div>
                  </div>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.25em] text-gray-500 dark:text-gray-400">
                    Uploaded by {asset.uploaded_by_admin?.name || asset.uploaded_by_client?.display_name || 'unknown'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{asset.created_at ? new Date(asset.created_at).toLocaleString() : ''}</p>
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
        {selectedPreviewAsset ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-3 py-6 sm:px-6">
            <div className="relative flex w-full max-w-5xl max-h-[90vh] flex-col gap-4 overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl ring-1 ring-black/10 dark:bg-gray-950 dark:ring-white/10 sm:p-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                  Asset viewer
                </p>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" onClick={() => handlePreviewNav('prev')}>
                    Prev
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => handlePreviewNav('next')}>
                    Next
                  </Button>
                  <Button type="button" variant="secondary" onClick={handleClosePreview}>
                    Close
                  </Button>
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
                <div className="lg:col-span-2">
                  {(() => {
                    const current = selectedPreviewAsset;
                    const currentUrl = current?.resolvedUrl;
                    const isImage = currentUrl && (current.kind === 'inspiration_image' || isImageUrl(currentUrl));
                    const isPdf = currentUrl && isPdfUrl(currentUrl);
                    if (isImage) {
                      return (
                        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-900">
                          <img
                            src={currentUrl}
                            alt={`${current.kind || 'Asset'} preview`}
                            className="h-[360px] w-full object-contain sm:h-[420px]"
                          />
                        </div>
                      );
                    }
                    if (isPdf) {
                      return (
                        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-900">
                          <iframe
                            title={`${current.kind || 'Asset'} document`}
                            src={currentUrl}
                            className="h-[360px] w-full sm:h-[420px]"
                          />
                        </div>
                      );
                    }
                    return (
                      <div className="flex h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-gray-50 text-center text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                        <p className="text-base font-semibold uppercase">{getFileExtension(currentUrl) || 'File'}</p>
                        <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                          Preview not available
                        </p>
                      </div>
                    );
                  })()}
                </div>
                <div className="space-y-3">
                  {(() => {
                    const current = selectedPreviewAsset;
                    const label = current.kind ? current.kind.replace(/_/g, ' ') : 'Asset';
                    return (
                      <>
                        <div className="space-y-2">
                          <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">{label}</p>
                          <p className="break-all text-sm text-gray-700 dark:text-gray-300">
                            {current.note_text || 'File attached'}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button as="a" href={current.resolvedUrl} target="_blank" rel="noreferrer" variant="secondary">
                            Open in new tab
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => handlePreviewNav('prev')}>
                            Previous
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => handlePreviewNav('next')}>
                            Next
                          </Button>
                        </div>
                        <p className="text-[11px] uppercase tracking-[0.25em] text-gray-400 dark:text-gray-500">
                          Uploaded by{' '}
                          {current.uploaded_by_admin?.name || current.uploaded_by_client?.display_name || 'unknown'}
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="-mx-2 mt-2 flex gap-2 overflow-x-auto px-2 pb-1">
                {previewableAssets.map((asset, index) => {
                  const thumbUrl = asset.resolvedUrl;
                  const isImageThumb = thumbUrl && (asset.kind === 'inspiration_image' || isImageUrl(thumbUrl));
                  const isActive = selectedPreviewAsset?.id === asset.id;
                  return (
                    <button
                      type="button"
                      key={asset.id}
                      onClick={() => handleOpenPreview(asset.id)}
                      className={`flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-xl border text-xs uppercase transition ${
                        isActive
                          ? 'border-gray-900 ring-2 ring-gray-900 dark:border-gray-100 dark:ring-gray-100'
                          : 'border-gray-200 dark:border-gray-800'
                      }`}
                      aria-label={`Open ${asset.kind || 'asset'} preview`}
                    >
                      {isImageThumb ? (
                        <img src={thumbUrl} alt={`${asset.kind || 'Asset'} thumbnail`} className="h-full w-full rounded-lg object-cover" />
                      ) : (
                        <span className="text-[11px] tracking-[0.2em] text-gray-600 dark:text-gray-300">
                          {getFileExtension(thumbUrl) || 'File'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </FadeIn>
    </main>
  );
}
