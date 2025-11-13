import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../../components/Button.jsx';
import Card from '../../components/Card.jsx';
import Dialog from '../../components/Dialog.jsx';
import SectionTitle from '../../components/SectionTitle.jsx';
import { apiDelete, apiPatch, apiUpload, resolveApiUrl } from '../../lib/api.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useClientPortal } from '../../contexts/ClientPortalContext.jsx';

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
        className={`inline-block h-5 w-5 rounded-full bg-black transition ${
          checked ? 'translate-x-6' : 'translate-x-1'
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

  const [isInspirationOpen, setIsInspirationOpen] = useState(false);
  const [inspirationFiles, setInspirationFiles] = useState([]);
  const [notes, setNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadMessage, setUploadMessage] = useState(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleteError, setDeleteError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const createFileEntries = (files) => {
    const limited = files.slice(0, 6);
    return limited.map((file) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return {
        id,
        placeholderId: `pending-${id}`,
        file,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
      };
    });
  };

  const applyFileSelection = (files) => {
    if (!files.length) {
      return;
    }
    const nextFiles = createFileEntries(files);
    setInspirationFiles((prev) => {
      prev.forEach((entry) => entry.previewUrl && URL.revokeObjectURL(entry.previewUrl));
      return nextFiles;
    });
    setNotes('');
    setUploadError(null);
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
    setIsUploading(true);
    setUploadError(null);
    setUploadMessage(null);

    const trimmedNotes = notes.trim();
    try {
      for (const entry of inspirationFiles) {
        const formData = new FormData();
        formData.append('file', entry.file);
        formData.append('kind', 'inspiration');
        if (trimmedNotes) {
          formData.append('notes', trimmedNotes);
        }
        await apiUpload('/api/account/documents', formData);
      }
      setUploadMessage('Inspiration uploaded successfully.');
      setNotes('');
      setInspirationFiles((prev) => {
        prev.forEach((entry) => entry.previewUrl && URL.revokeObjectURL(entry.previewUrl));
        return [];
      });
      refresh();
    } catch (err) {
      setUploadError(err?.message || 'Unable to upload inspiration right now.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await apiDelete('/api/account');
      await logout();
      navigate('/auth', { replace: true });
    } catch (err) {
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
    <div className="space-y-8">
      <SectionTitle eyebrow="Client portal" title="Profile" description="Stay in view mode until you opt to edit." />

      <Card ref={profileRef} className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Personal info</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Always view-only unless you tap edit.</p>
          </div>
          <Button variant="ghost" onClick={() => setIsEditingProfile((prev) => !prev)}>
            {isEditingProfile ? 'Cancel' : 'Edit'}
          </Button>
        </div>
        {isEditingProfile ? (
          <form className="space-y-4" onSubmit={handleProfileSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                First name
                <input value={profileForm.first_name} onChange={handleProfileChange('first_name')} className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-black dark:border-gray-700 dark:bg-gray-950" required />
              </label>
              <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                Last name
                <input value={profileForm.last_name} onChange={handleProfileChange('last_name')} className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-black dark:border-gray-700 dark:bg-gray-950" required />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                Email
                <input type="email" value={profileForm.email} onChange={handleProfileChange('email')} className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-black dark:border-gray-700 dark:bg-gray-950" required />
              </label>
              <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                Phone
                <input value={profileForm.phone} onChange={handleProfileChange('phone')} className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-black dark:border-gray-700 dark:bg-gray-950" />
              </label>
            </div>
            {profileStatus ? <p className="text-xs uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400">{profileStatus}</p> : null}
            {profileError ? <p className="text-xs uppercase tracking-[0.3em] text-rose-600 dark:text-rose-300">{profileError}</p> : null}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={isSavingProfile}>
                {isSavingProfile ? 'Saving…' : 'Save changes'}
              </Button>
              <Button variant="ghost" onClick={() => setIsEditingProfile(false)} disabled={isSavingProfile}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <dl className="grid gap-4 md:grid-cols-2">
            <div>
              <dt className="text-[0.6rem] uppercase tracking-[0.4em] text-gray-500 dark:text-gray-400">First name</dt>
              <dd className="text-sm text-gray-900 dark:text-gray-100">{profile?.first_name || '—'}</dd>
            </div>
            <div>
              <dt className="text-[0.6rem] uppercase tracking-[0.4em] text-gray-500 dark:text-gray-400">Last name</dt>
              <dd className="text-sm text-gray-900 dark:text-gray-100">{profile?.last_name || '—'}</dd>
            </div>
            <div>
              <dt className="text-[0.6rem] uppercase tracking-[0.4em] text-gray-500 dark:text-gray-400">Email</dt>
              <dd className="text-sm text-gray-900 dark:text-gray-100">{profile?.email || '—'}</dd>
            </div>
            <div>
              <dt className="text-[0.6rem] uppercase tracking-[0.4em] text-gray-500 dark:text-gray-400">Phone</dt>
              <dd className="text-sm text-gray-900 dark:text-gray-100">{profile?.phone || '—'}</dd>
            </div>
            <div>
              <dt className="text-[0.6rem] uppercase tracking-[0.4em] text-gray-500 dark:text-gray-400">Member since</dt>
              <dd className="text-sm text-gray-900 dark:text-gray-100">{formatDate(profile?.created_at)}</dd>
            </div>
            <div>
              <dt className="text-[0.6rem] uppercase tracking-[0.4em] text-gray-500 dark:text-gray-400">Last login</dt>
              <dd className="text-sm text-gray-900 dark:text-gray-100">{formatDate(profile?.last_login_at)}</dd>
            </div>
          </dl>
        )}
      </Card>

      <Card ref={documentsRef} className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Documents & studio files</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">All shared PDFs, policies, and aftercare guides.</p>
          </div>
          <Button variant="ghost" onClick={() => navigate('/share-your-idea')}>
            Book consult
          </Button>
        </div>
        {sharedDocuments?.length ? (
          <div className="space-y-3">
            {sharedDocuments.map((document) => (
              <article
                key={document.id}
                className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white/80 p-4 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-950/60 dark:text-gray-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{document.title}</p>
                    <p className="text-[0.6rem] uppercase tracking-[0.35em] text-gray-500 dark:text-gray-400">{document.kind.replace(/_/g, ' ')}</p>
                  </div>
                  <span className="text-[0.55rem] font-semibold uppercase tracking-[0.35em] text-gray-500 dark:text-gray-400">
                    {document.source === 'you' ? 'You' : 'Studio'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{document.notes}</p>
                <div className="flex items-center justify-between text-[0.6rem] uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
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
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">No studio files yet.</p>
        )}
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Contact preferences</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Toggle what updates you want to receive.</p>
          </div>
          {prefSaving ? <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Saving…</p> : null}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {PREFERENCE_CONFIG.map((preference) => (
            <div key={preference.key} className="flex items-start justify-between rounded-2xl border border-gray-200 bg-white/80 p-4 dark:border-gray-800 dark:bg-gray-950/60">
              <div>
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

      <Card ref={inspirationRef} className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Inspiration uploads</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Drop files, add notes, and keep the studio inspired.</p>
          </div>
          <Button variant="ghost" onClick={() => setIsInspirationOpen((prev) => !prev)}>
            {isInspirationOpen ? 'Hide' : 'Upload'}
          </Button>
        </div>
        {isInspirationOpen ? (
          <form className="space-y-4" onSubmit={handleUploadInspiration}>
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Inspiration files</label>
              <input
                type="file"
                id="inspiration-upload"
                multiple
                accept="image/png,image/jpeg,image/jpg,image/heic,image/heif,image/webp,pdf,txt,doc,docx"
                onChange={handleFileChange}
                className="sr-only"
              />
              <div
                className="mt-2 rounded-2xl border border-dashed border-gray-300 bg-gray-50/70 px-4 py-8 text-center text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-950/60 dark:text-gray-300"
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
              >
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <label htmlFor="inspiration-upload">
                    <Button variant="ghost">Choose files</Button>
                  </label>
                  <p className="max-w-xs text-[0.65rem] text-gray-500 dark:text-gray-300">
                    Drop PNG / JPEG / WebP / PDF / DOC / TXT here (max 6 files).
                  </p>
                </div>
                <p className="mt-3 text-[0.6rem] text-gray-500 dark:text-gray-400">
                  {inspirationFiles.length
                    ? `${inspirationFiles.length} file${inspirationFiles.length > 1 ? 's' : ''} ready to upload`
                    : 'No files selected yet.'}
                </p>
              </div>
              {inspirationFiles.length ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {inspirationFiles.map((file) => (
                    <div key={file.id} className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-3 text-xs text-gray-700 dark:border-gray-800 dark:bg-gray-950/60">
                      <div className="flex items-center justify-between">
                        <p className="truncate font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">{file.file.name}</p>
                        <button type="button" onClick={() => handleRemoveFile(file.id)} className="text-[0.6rem] uppercase tracking-[0.4em] text-gray-400 hover:text-rose-500">
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
            <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
              Notes for the artist (optional)
              <textarea
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-black dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </label>
            {uploadError ? <p className="text-xs uppercase tracking-[0.3em] text-rose-600 dark:text-rose-300">{uploadError}</p> : null}
            {uploadMessage ? <p className="text-xs uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400">{uploadMessage}</p> : null}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={isUploading || !inspirationFiles.length}>
                {isUploading ? 'Uploading…' : 'Upload inspiration'}
              </Button>
              <p className="text-xs text-gray-500 dark:text-gray-400">We keep the latest six uploads ready for review.</p>
            </div>
          </form>
        ) : null}
        {documents?.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {documents.map((document) => (
              <article key={document.id} className="rounded-2xl border border-gray-200 bg-white/80 p-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-950/60 dark:text-gray-200">
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
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">No inspiration uploads yet.</p>
        )}
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Danger zone</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Deleting removes all data permanently.</p>
          </div>
          <Button variant="secondary" onClick={() => setDeleteModalOpen(true)}>
            Delete account
          </Button>
        </div>
      </Card>

      <Dialog
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete account"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteModalOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={handleDeleteAccount} disabled={deleteInput.trim().toUpperCase() !== 'DELETE' || isDeleting}>
              {isDeleting ? 'Deleting…' : 'Delete account'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          This action cannot be undone. Re-enter DELETE to confirm and remove everything associated with your account.
        </p>
        <input
          type="text"
          value={deleteInput}
          onChange={(event) => setDeleteInput(event.target.value)}
          className="mt-4 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          placeholder="Type DELETE to confirm"
        />
        {deleteError ? <p className="text-xs uppercase tracking-[0.3em] text-rose-600 dark:text-rose-300">{deleteError}</p> : null}
      </Dialog>
    </div>
  );
}
