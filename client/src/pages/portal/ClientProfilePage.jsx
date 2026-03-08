import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../../components/Button.jsx';
import Card from '../../components/Card.jsx';
import Dialog from '../../components/Dialog.jsx';
import SectionTitle from '../../components/SectionTitle.jsx';
import { apiDelete, apiPatch, apiPost, apiUpload, resolveApiUrl } from '../../lib/api.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useClientPortal } from '../../contexts/ClientPortalContext.jsx';
import {
  getClientSideUploadError,
  getUploadErrorMessage,
  validateDocumentBeforeUpload
} from '../../lib/uploadValidation.js';

const PREFERENCE_CONFIG = [
  {
    key: 'email_reminders',
    label: 'Email reminders',
    description: 'Receive appointment alerts and updates via email.'
  },
  {
    key: 'sms_reminders',
    label: 'SMS reminders',
    description: 'Text notifications for upcoming sessions.'
  },
  {
    key: 'aftercare_emails',
    label: 'Aftercare emails',
    description: 'Tips and care instructions after your session.'
  }
];

function ToggleSwitch({ checked, disabled, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-12 items-center rounded-full border border-gray-300 bg-white transition dark:border-gray-700 dark:bg-gray-900"
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-black transition ${checked ? 'translate-x-6' : 'translate-x-1'
          }`}
      />
    </button>
  );
}

function formatDate(value) {
  if (!value) {
    return '—';
  }
  try {
    return new Date(value).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

const ACCEPTED_UPLOAD_TYPES = 'image/png,image/jpeg,image/jpg,image/webp,application/pdf,.pdf,.doc,.docx,.txt';
const IMAGE_NAME_PATTERN = /\.(jpe?g|png|webp)$/i;

function isImageFile(file) {
  if (!file) {
    return false;
  }
  if (file.type?.startsWith('image/')) {
    return true;
  }
  if (typeof file.name === 'string') {
    return IMAGE_NAME_PATTERN.test(file.name);
  }
  return false;
}

function isImageName(name) {
  if (!name) {
    return false;
  }
  const urlString = String(name).trim();
  if (urlString.startsWith('data:image/')) {
    return true;
  }
  // Legacy or encrypted private photos served from our backend API 
  // might not have extensions in the URL string natively
  if (urlString.includes('/api/uploads/')) {
    return true;
  }
  return IMAGE_NAME_PATTERN.test(name);
}

export default function ClientProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const {
    loading,
    error,
    profile,
    documents,
    sharedDocuments,
    refresh
  } = useClientPortal();

  const profileRef = useRef(null);
  const inspirationRef = useRef(null);
  const documentsRef = useRef(null);
  const previewRefs = useRef([]);
  const inspirationUploadRef = useRef(null);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: ''
  });
  const [profileStatus, setProfileStatus] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [preferences, setPreferences] = useState(() => {
    const defaults = {};
    PREFERENCE_CONFIG.forEach((item) => {
      defaults[item.key] = true;
    });
    return defaults;
  });
  const [prefMessage, setPrefMessage] = useState(null);
  const [prefError, setPrefError] = useState(null);
  const [prefSaving, setPrefSaving] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [passwordStatus, setPasswordStatus] = useState(null);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [verificationStatus, setVerificationStatus] = useState(null);
  const [verificationError, setVerificationError] = useState(null);
  const [sendingVerification, setSendingVerification] = useState(false);

  const [isInspirationOpen, setIsInspirationOpen] = useState(false);
  const [inspirationFiles, setInspirationFiles] = useState([]);
  const [notes, setNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadMessage, setUploadMessage] = useState(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!deleteDialogOpen) {
      return;
    }
    setDeleteError(null);
  }, [deleteDialogOpen]);

  useEffect(() => {
    if (!profile) {
      return;
    }
    setProfileForm({
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      email: profile.email || '',
      phone: profile.phone || ''
    });
    if (profile.preferences) {
      setPreferences(profile.preferences);
    }
  }, [profile]);

  useEffect(() => {
    if (!location.state?.focus) {
      return;
    }
    const maybeRef = {
      inspiration: inspirationRef,
      documents: documentsRef,
      profile: profileRef
    }[location.state.focus];
    if (location.state.focus === 'inspiration') {
      setIsInspirationOpen(true);
    }
    if (maybeRef?.current) {
      maybeRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  const handleProfileChange = (field) => (event) => {
    setProfileForm((prev) => ({ ...prev, [field]: event.target.value }));
    setProfileStatus(null);
    setProfileError(null);
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    if (!profile) {
      return;
    }
    setIsSavingProfile(true);
    setProfileError(null);
    setProfileStatus(null);

    const payload = {
      first_name: profileForm.first_name.trim(),
      last_name: profileForm.last_name.trim(),
      email: profileForm.email.trim(),
      phone: profileForm.phone.trim()
    };

    try {
      await apiPatch('/api/account/profile', payload);
      setProfileStatus('Profile updated.');
      setIsEditingProfile(false);
      refresh();
    } catch (err) {
      setProfileError(err?.message || 'Unable to save your profile right now.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePreferenceToggle = async (key, value) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
    setPrefMessage(null);
    setPrefError(null);
    setPrefSaving(true);
    try {
      await apiPatch('/api/account/preferences', { [key]: value });
      setPrefMessage('Preferences saved.');
      refresh();
    } catch (err) {
      setPrefError(err?.message || 'Unable to update preference.');
      setPreferences((prev) => ({ ...prev, [key]: !value }));
    } finally {
      setPrefSaving(false);
    }
  };

  const handlePasswordChange = (field) => (event) => {
    setPasswordForm((prev) => ({ ...prev, [field]: event.target.value }));
    setPasswordStatus(null);
    setPasswordError(null);
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordSaving(true);
    setPasswordStatus(null);
    setPasswordError(null);

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError('New password and confirmation must match.');
      setPasswordSaving(false);
      return;
    }

    try {
      await apiPost('/api/account/password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password
      });
      setPasswordStatus('Password updated.');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      refresh();
    } catch (err) {
      setPasswordError(err?.body?.error || 'Unable to update password right now.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSendVerification = async () => {
    if (!profile?.email) {
      return;
    }
    setSendingVerification(true);
    setVerificationStatus(null);
    setVerificationError(null);
    try {
      const response = await apiPost('/api/auth/email/verify-request', { email: profile.email });
      setVerificationStatus(response?.status === 'already_verified' ? 'Email already verified.' : 'Verification email sent.');
    } catch (err) {
      setVerificationError(err?.body?.error || 'Unable to send verification email.');
    } finally {
      setSendingVerification(false);
    }
  };

  const createFileEntries = (files) => {
    return files.map((file) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return {
        id,
        placeholderId: `pending-${id}`,
        file,
        previewUrl: isImageFile(file) ? URL.createObjectURL(file) : null
      };
    });
  };

  const applyFileSelection = (files) => {
    if (!files.length) {
      return;
    }
    const limitedFiles = files.slice(0, 6);
    const validFiles = [];
    let validationReason = null;

    limitedFiles.forEach((file) => {
      const validation = validateDocumentBeforeUpload(file);
      if (validation.isValid) {
        validFiles.push(file);
        return;
      }
      if (!validationReason) {
        validationReason = validation.reason;
      }
    });

    if (!validFiles.length) {
      setUploadError(getClientSideUploadError(validationReason));
      return;
    }

    setUploadError(validationReason ? getClientSideUploadError(validationReason) : null);
    const nextFiles = createFileEntries(validFiles);
    setInspirationFiles((prev) => {
      prev.forEach((entry) => entry.previewUrl && URL.revokeObjectURL(entry.previewUrl));
      return nextFiles;
    });
    setNotes('');
    setUploadMessage(null);
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    applyFileSelection(files);
    event.target.value = '';
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files || []);
    applyFileSelection(files);
  };

  const handleRemoveFile = (fileId) => {
    setInspirationFiles((prev) => {
      const remaining = prev.filter((entry) => entry.id !== fileId);
      const removed = prev.find((entry) => entry.id === fileId);
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return remaining;
    });
  };

  const handleUploadInspiration = async (event) => {
    event.preventDefault();
    if (!inspirationFiles.length) {
      setUploadError('Add at least one file before uploading.');
      return;
    }
    for (const entry of inspirationFiles) {
      const validation = validateDocumentBeforeUpload(entry.file);
      if (!validation.isValid) {
        setUploadError(getClientSideUploadError(validation.reason));
        return;
      }
    }
    setIsUploading(true);
    setUploadError(null);
    setUploadMessage(null);

    const trimmedNotes = notes.trim();
    try {
      for (const entry of inspirationFiles) {
        const formData = new FormData();
        formData.append('file', entry.file);
        formData.append('kind', isImageFile(entry.file) ? 'inspiration' : 'document');
        formData.append('title', entry.file.name);
        if (trimmedNotes) {
          formData.append('notes', trimmedNotes);
        }
        await apiUpload('/api/account/documents', formData);
      }
      setUploadMessage('Files uploaded successfully.');
      setNotes('');
      setInspirationFiles((prev) => {
        prev.forEach((entry) => entry.previewUrl && URL.revokeObjectURL(entry.previewUrl));
        return [];
      });
      await refresh();
    } catch (err) {
      const message = getUploadErrorMessage(err) ?? 'Unable to upload files right now.';
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAccount = async (event) => {
    event?.preventDefault();
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await apiDelete('/api/account');
      await logout();
      navigate('/auth', { replace: true });
    } catch (err) {
      if (err?.status === 401) {
        await logout();
        navigate('/auth', { replace: true });
        return;
      }
      setDeleteError(err?.message || 'Unable to delete your account at this time.');
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    previewRefs.current = inspirationFiles;
  }, [inspirationFiles]);

  useEffect(() => {
    return () => {
      previewRefs.current.forEach((entry) => entry.previewUrl && URL.revokeObjectURL(entry.previewUrl));
    };
  }, []);

  const openDeleteDialog = () => {
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    if (isDeleting) {
      return;
    }
    setDeleteDialogOpen(false);
  };

  const combinedDocuments = useMemo(() => {
    const list = [...(documents || []), ...(sharedDocuments || [])];
    return list.sort((a, b) => {
      const aDate = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const bDate = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return bDate - aDate;
    });
  }, [documents, sharedDocuments]);

  const profileName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.email || 'Your profile';
  const initials = `${profile?.first_name?.[0] ?? ''}${profile?.last_name?.[0] ?? ''}`.trim().toUpperCase() || 'YO';
  const memberSince = formatDate(profile?.created_at);
  const lastLogin = formatDate(profile?.last_login_at);
  const lastPasswordChange = formatDate(profile?.last_password_change_at);
  const emailVerified = !!profile?.email_verified;

  const focusInspirationUpload = () => {
    setIsInspirationOpen(true);
    inspirationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDropZoneKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      inspirationUploadRef.current?.click();
    }
  };

  if (loading) {
    return (
      <main className="space-y-8">
        <SectionTitle eyebrow="Client portal" title="Profile" description="Loading your account…" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="space-y-8">
        <SectionTitle eyebrow="Client portal" title="Profile" description="We hit a snag." />
        <Card className="text-xs uppercase tracking-[0.3em] text-rose-600 dark:text-rose-300">{error}</Card>
        <Button variant="secondary" onClick={() => navigate('/auth')}>
          Return to sign in
        </Button>
      </main>
    );
  }

  return (
    <main className="space-y-8">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-gray-100 via-white to-gray-100 p-6 shadow-lg ring-1 ring-black/5 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 dark:ring-white/10 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xl font-bold uppercase text-white shadow-lg shadow-indigo-200 dark:shadow-none">
              {initials}
            </div>
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.35em] text-gray-500 dark:text-gray-400">Profile</p>
              <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-50">{profileName}</h1>
              <div className="mt-2 flex flex-wrap gap-2 text-sm text-gray-600 dark:text-gray-300">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 shadow-sm ring-1 ring-black/5 backdrop-blur dark:bg-gray-900/40 dark:ring-white/10">
                  ✨ Member since {memberSince}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-800/60">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={() => setIsEditingProfile((prev) => !prev)}>
              {isEditingProfile ? 'Cancel edit' : 'Edit profile'}
            </Button>
            <Button onClick={() => navigate('/share-your-idea')}>Book consultation</Button>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/80 p-4 text-sm text-gray-600 shadow-sm ring-1 ring-black/5 backdrop-blur dark:bg-gray-900/60 dark:text-gray-200 dark:ring-white/10">
            <p className="text-[0.65rem] uppercase tracking-[0.35em] text-gray-500 dark:text-gray-400">Email</p>
            <p className="truncate text-base font-semibold text-gray-900 dark:text-gray-50">{profile?.email || '—'}</p>
          </div>
          <div className="rounded-2xl bg-white/80 p-4 text-sm text-gray-600 shadow-sm ring-1 ring-black/5 backdrop-blur dark:bg-gray-900/60 dark:text-gray-200 dark:ring-white/10">
            <p className="text-[0.65rem] uppercase tracking-[0.35em] text-gray-500 dark:text-gray-400">Phone</p>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-50">{profile?.phone || '—'}</p>
          </div>
          <div className="rounded-2xl bg-white/80 p-4 text-sm text-gray-600 shadow-sm ring-1 ring-black/5 backdrop-blur dark:bg-gray-900/60 dark:text-gray-200 dark:ring-white/10">
            <p className="text-[0.65rem] uppercase tracking-[0.35em] text-gray-500 dark:text-gray-400">Last login</p>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-50">{lastLogin}</p>
          </div>
        </div>
      </section>

      <Card ref={profileRef} className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Personal information</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Manage your contact details without leaving the portal.</p>
          </div>
          <Button variant="ghost" onClick={() => setIsEditingProfile((prev) => !prev)}>
            {isEditingProfile ? 'Exit edit mode' : 'Edit details'}
          </Button>
        </div>
        {isEditingProfile ? (
          <form className="space-y-5" onSubmit={handleProfileSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">First name</span>
                <input
                  value={profileForm.first_name}
                  onChange={handleProfileChange('first_name')}
                  className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-black dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  required
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Last name</span>
                <input
                  value={profileForm.last_name}
                  onChange={handleProfileChange('last_name')}
                  className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-black dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  required
                />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Email</span>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={handleProfileChange('email')}
                  className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-black dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  required
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Phone</span>
                <input
                  value={profileForm.phone}
                  onChange={handleProfileChange('phone')}
                  className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-black dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </label>
            </div>
            {profileStatus ? <p className="text-xs uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400">{profileStatus}</p> : null}
            {profileError ? <p className="text-xs uppercase tracking-[0.3em] text-rose-600 dark:text-rose-300">{profileError}</p> : null}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={isSavingProfile}>
                {isSavingProfile ? 'Saving…' : 'Save profile'}
              </Button>
              <Button variant="ghost" onClick={() => setIsEditingProfile(false)} disabled={isSavingProfile}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <dl className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-gray-50 p-4 text-gray-700 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-800">
              <dt className="text-[0.65rem] uppercase tracking-[0.35em] text-gray-500 dark:text-gray-400">First name</dt>
              <dd className="text-base font-semibold">{profile?.first_name || '—'}</dd>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4 text-gray-700 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-800">
              <dt className="text-[0.65rem] uppercase tracking-[0.35em] text-gray-500 dark:text-gray-400">Last name</dt>
              <dd className="text-base font-semibold">{profile?.last_name || '—'}</dd>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4 text-gray-700 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-800">
              <dt className="text-[0.65rem] uppercase tracking-[0.35em] text-gray-500 dark:text-gray-400">Email</dt>
              <dd className="text-base font-semibold">{profile?.email || '—'}</dd>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4 text-gray-700 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-800">
              <dt className="text-[0.65rem] uppercase tracking-[0.35em] text-gray-500 dark:text-gray-400">Phone</dt>
              <dd className="text-base font-semibold">{profile?.phone || '—'}</dd>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4 text-gray-700 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-800">
              <dt className="text-[0.65rem] uppercase tracking-[0.35em] text-gray-500 dark:text-gray-400">Member since</dt>
              <dd className="text-base font-semibold">{memberSince}</dd>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4 text-gray-700 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-800">
              <dt className="text-[0.65rem] uppercase tracking-[0.35em] text-gray-500 dark:text-gray-400">Last login</dt>
              <dd className="text-base font-semibold">{lastLogin}</dd>
            </div>
          </dl>
        )}
      </Card>

      <Card className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Security</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Verify your email and keep your password fresh.</p>
          </div>
          {passwordStatus ? (
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400">{passwordStatus}</p>
          ) : null}
          {passwordError ? (
            <p className="text-xs uppercase tracking-[0.3em] text-rose-600 dark:text-rose-300">{passwordError}</p>
          ) : null}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-gray-50 p-4 ring-1 ring-gray-200 dark:bg-gray-950/70 dark:ring-gray-800">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Email verification</p>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">
              {emailVerified ? 'Email verified.' : 'Verify your email to enable password recovery and reminders.'}
            </p>
            <p className="mt-2 text-[0.7rem] uppercase tracking-[0.25em] text-gray-500 dark:text-gray-400">
              Last password change: {lastPasswordChange}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button type="button" variant={emailVerified ? 'secondary' : 'primary'} onClick={handleSendVerification} disabled={sendingVerification || !profile?.email}>
                {sendingVerification ? 'Sending…' : emailVerified ? 'Resend code' : 'Send verification email'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  navigate(
                    `/verify-email${profile?.email ? `?email=${encodeURIComponent(profile.email)}` : ''}`
                  )
                }
              >
                Enter code
              </Button>
            </div>
            {verificationStatus ? (
              <p className="mt-3 text-xs uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400">{verificationStatus}</p>
            ) : null}
            {verificationError ? (
              <p className="mt-3 text-xs uppercase tracking-[0.3em] text-rose-600 dark:text-rose-300">{verificationError}</p>
            ) : null}
          </div>
          <form className="space-y-3 rounded-2xl bg-gray-50 p-4 ring-1 ring-gray-200 dark:bg-gray-950/70 dark:ring-gray-800" onSubmit={handlePasswordSubmit}>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Update password</p>
            <label className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Current password</span>
              <input
                type="password"
                value={passwordForm.current_password}
                onChange={handlePasswordChange('current_password')}
                className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-black dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                required
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">New password</span>
              <input
                type="password"
                value={passwordForm.new_password}
                onChange={handlePasswordChange('new_password')}
                className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-black dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                required
                minLength={8}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Confirm password</span>
              <input
                type="password"
                value={passwordForm.confirm_password}
                onChange={handlePasswordChange('confirm_password')}
                className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-black dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                required
                minLength={8}
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={passwordSaving}>
                {passwordSaving ? 'Saving…' : 'Update password'}
              </Button>
              <p className="text-[0.65rem] uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                Minimum 8 characters.
              </p>
            </div>
          </form>
        </div>
      </Card>

      <Card ref={documentsRef} className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Documents & studio files</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Access shared PDFs, policies, and guides without reloading.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={focusInspirationUpload}>
              Upload files
            </Button>
            <Button variant="secondary" onClick={() => navigate('/share-your-idea')}>
              Book consultation
            </Button>
          </div>
        </div>
        {combinedDocuments.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {combinedDocuments.map((document) => (
              <article
                key={document.id}
                className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white/80 p-4 text-sm text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-800 dark:bg-gray-950/70 dark:text-gray-200"
              >
                <div className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                  {isImageName(document.file_url || document.title) ? (
                    <img
                      src={resolveApiUrl(document.file_url)}
                      alt={document.title || 'Uploaded file'}
                      className="h-36 w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-36 items-center justify-center text-3xl" aria-hidden="true">
                      📄
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-50">{document.title}</p>
                    <p className="text-[0.6rem] uppercase tracking-[0.35em] text-gray-500 dark:text-gray-400">
                      {document.kind ? document.kind.replace(/_/g, ' ') : 'document'}
                    </p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                    {document.source === 'you' ? 'You' : 'Studio'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-300">{document.notes}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[0.65rem] uppercase tracking-[0.35em] text-gray-500 dark:text-gray-400">
                  <span>{formatDate(document.created_at)}</span>
                  <Button
                    as="a"
                    variant="ghost"
                    href={resolveApiUrl(document.file_url)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View / download
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 px-6 py-10 text-center text-gray-500 dark:border-gray-800 dark:bg-gray-950/50 dark:text-gray-400">
            <div className="text-3xl">📁</div>
            <p className="mt-2 text-sm font-semibold text-gray-700 dark:text-gray-200">No documents yet</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Upload files or check back when the studio shares theirs.</p>
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Communication preferences</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Choose how you want reminders and aftercare updates.</p>
          </div>
          {prefSaving ? <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Saving…</p> : null}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {PREFERENCE_CONFIG.map((preference) => (
            <div
              key={preference.key}
              className="flex items-start justify-between rounded-2xl bg-gray-50 p-4 ring-1 ring-gray-200 transition hover:-translate-y-0.5 hover:ring-black/10 dark:bg-gray-950/60 dark:ring-gray-800"
            >
              <div className="space-y-1">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-900 dark:text-gray-100">{preference.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{preference.description}</p>
              </div>
              <ToggleSwitch
                checked={!!preferences[preference.key]}
                disabled={prefSaving}
                onChange={(value) => handlePreferenceToggle(preference.key, value)}
              />
            </div>
          ))}
        </div>
        {prefMessage ? <p className="text-xs uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400">{prefMessage}</p> : null}
        {prefError ? <p className="text-xs uppercase tracking-[0.3em] text-rose-600 dark:text-rose-300">{prefError}</p> : null}
      </Card>

      <Card ref={inspirationRef} className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Uploads</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Share references or documents with the studio without refreshing the page.</p>
          </div>
          <Button variant="ghost" onClick={() => setIsInspirationOpen((prev) => !prev)}>
            {isInspirationOpen ? 'Hide upload' : 'Upload files'}
          </Button>
        </div>
        {isInspirationOpen ? (
          <form className="space-y-4" onSubmit={handleUploadInspiration}>
            <div>
              <input
                ref={inspirationUploadRef}
                type="file"
                id="inspiration-upload"
                multiple
                accept={ACCEPTED_UPLOAD_TYPES}
                onChange={handleFileChange}
                className="sr-only"
              />
              <div
                role="button"
                tabIndex={0}
                onClick={() => inspirationUploadRef.current?.click()}
                onKeyDown={handleDropZoneKeyDown}
                className="mt-1 cursor-pointer rounded-2xl border border-dashed border-gray-300 bg-gray-50/70 p-6 text-center shadow-inner transition hover:border-indigo-400 hover:bg-white dark:border-gray-700 dark:bg-gray-950/60 dark:hover:border-indigo-500"
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
              >
                <label htmlFor="inspiration-upload" className="flex flex-col items-center gap-2">
                  <span className="text-3xl">📤</span>
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Drop PNG, JPEG, WebP, PDF, DOC/DOCX, or TXT files</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Up to 6 files. Click to choose from your device.</span>
                </label>
                <p className="mt-3 text-[0.7rem] text-gray-500 dark:text-gray-400">
                  {inspirationFiles.length
                    ? `${inspirationFiles.length} file${inspirationFiles.length > 1 ? 's' : ''} ready to upload`
                    : 'No files selected yet.'}
                </p>
              </div>
              {inspirationFiles.length ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {inspirationFiles.map((file) => (
                    <div
                      key={file.id}
                      className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-3 text-xs text-gray-700 shadow-sm dark:border-gray-800 dark:bg-gray-950/70"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">{file.file.name}</p>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(file.id)}
                          className="text-[0.6rem] uppercase tracking-[0.4em] text-gray-400 hover:text-rose-500"
                        >
                          Remove
                        </button>
                      </div>
                      {file.previewUrl ? (
                        <img src={file.previewUrl} alt={file.file.name} className="mt-2 h-28 w-full rounded-xl object-cover" />
                      ) : (
                        <div className="mt-2 flex h-28 items-center justify-center rounded-xl bg-gray-100 text-[0.7rem] text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                          Preview unavailable
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <label className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Notes for the artist (optional)</span>
              <textarea
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-black dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </label>
            {uploadError ? <p className="text-xs uppercase tracking-[0.3em] text-rose-600 dark:text-rose-300">{uploadError}</p> : null}
            {uploadMessage ? <p className="text-xs uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400">{uploadMessage}</p> : null}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={isUploading || !inspirationFiles.length}>
                {isUploading ? 'Uploading…' : 'Upload files'}
              </Button>
              <p className="text-xs text-gray-500 dark:text-gray-400">We keep the latest six uploads ready for review.</p>
            </div>
          </form>
        ) : null}
        {documents?.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {documents.map((document) => (
              <article
                key={document.id}
                className="rounded-2xl border border-gray-200 bg-white/80 p-3 text-sm text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-800 dark:bg-gray-950/60 dark:text-gray-200"
              >
                <div className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                  {isImageName(document.file_url || document.title) ? (
                    <img
                      src={resolveApiUrl(document.file_url)}
                      alt={document.title || 'Uploaded file'}
                      className="h-32 w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-32 items-center justify-center text-2xl" aria-hidden="true">
                      📄
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{document.title}</p>
                    <p className="text-[0.55rem] uppercase tracking-[0.4em] text-gray-500 dark:text-gray-400">{document.kind.replace(/_/g, ' ')}</p>
                  </div>
                  <span className="text-[0.6rem] font-semibold uppercase tracking-[0.4em] text-gray-500 dark:text-gray-400">
                    {document.source === 'you' ? 'You' : 'Studio'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{document.notes}</p>
                <div className="mt-3 flex items-center justify-between text-[0.6rem] uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                  <span>{formatDate(document.created_at)}</span>
                  <a href={resolveApiUrl(document.file_url)} target="_blank" rel="noreferrer" className="font-semibold text-gray-900 underline dark:text-gray-100">
                    View file
                  </a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">No uploads yet.</p>
        )}
      </Card>

      <Card className="space-y-4 border-rose-200/80 bg-rose-50/80 text-rose-900 ring-1 ring-rose-200 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100 dark:ring-rose-800/60">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-rose-700 dark:text-rose-200">Danger zone</p>
            <p className="text-sm text-rose-800 dark:text-rose-100">Remove your account and all associated data.</p>
          </div>
          <Button variant="secondary" onClick={openDeleteDialog}>
            Delete account
          </Button>
        </div>
      </Card>

      <Dialog
        open={deleteDialogOpen}
        onClose={closeDeleteDialog}
        title="Delete account"
        footer={
          <>
            <Button variant="ghost" onClick={closeDeleteDialog} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              form="delete-account-form"
              type="submit"
              variant="secondary"
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting…' : 'Delete account'}
            </Button>
          </>
        }
      >
        <form
          id="delete-account-form"
          className="space-y-4"
          onSubmit={handleDeleteAccount}
        >
          <p className="text-sm text-gray-600 dark:text-gray-400">
            This action cannot be undone. Click delete below to permanently remove your account and all associated data.
          </p>
          {deleteError ? <p className="text-xs uppercase tracking-[0.3em] text-rose-600 dark:text-rose-300">{deleteError}</p> : null}
        </form>
      </Dialog>
    </main>
  );
}
