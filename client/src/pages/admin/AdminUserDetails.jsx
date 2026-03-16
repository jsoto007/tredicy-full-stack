import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../../components/Button.jsx';
import Card from '../../components/Card.jsx';
import SectionTitle from '../../components/SectionTitle.jsx';
import { resolveApiUrl } from '../../lib/api.js';
import { useAdminDashboard } from './AdminDashboardContext.jsx';

function formatDateTime(value, fallback = 'Not recorded') {
  if (!value) {
    return fallback;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return date.toLocaleString();
}

function formatDate(value, fallback = 'Not recorded') {
  if (!value) {
    return fallback;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return date.toLocaleDateString();
}

function normaliseAssetKind(kind) {
  if (!kind) {
    return 'Attachment';
  }
  return kind.replace(/_/g, ' ');
}

export default function AdminUserDetails() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const numericUserId = Number(userId);

  const {
    state: { users, recentUsers, appointments, availableRoles },
    actions: { refreshUsers, refreshAppointments, updateUserRole }
  } = useAdminDashboard();

  const [userProfile, setUserProfile] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [userError, setUserError] = useState(null);
  const [pendingRoleChange, setPendingRoleChange] = useState(false);

  const findUserInStore = useCallback(() => {
    if (!numericUserId) {
      return null;
    }
    const directory = [
      ...(Array.isArray(users) ? users : []),
      ...(Array.isArray(recentUsers) ? recentUsers : [])
    ];
    return directory.find((entry) => entry.id === numericUserId) || null;
  }, [numericUserId, users, recentUsers]);

  useEffect(() => {
    if (!numericUserId) {
      setUserError('Invalid user identifier.');
      setLoadingUser(false);
      return;
    }
    const match = findUserInStore();
    if (match) {
      setUserProfile(match);
      setUserError(null);
      setLoadingUser(false);
      return;
    }

    let cancelled = false;
    setLoadingUser(true);
    refreshUsers()
      .then((response) => {
        if (cancelled) {
          return;
        }
        const list = Array.isArray(response) ? response : [];
        const fetchedMatch = list.find((entry) => entry.id === numericUserId) || null;
        if (fetchedMatch) {
          setUserProfile(fetchedMatch);
          setUserError(null);
        } else {
          setUserError('User not found.');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUserError('Unable to load user profile.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingUser(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [numericUserId, refreshUsers, findUserInStore]);

  useEffect(() => {
    if (!numericUserId) {
      return;
    }
    const match = findUserInStore();
    if (match) {
      setUserProfile(match);
      setUserError(null);
      setLoadingUser(false);
    }
  }, [numericUserId, findUserInStore]);

  useEffect(() => {
    if (!Array.isArray(appointments) || appointments.length === 0) {
      refreshAppointments().catch(() => {});
    }
  }, [appointments, refreshAppointments]);

  const roleOptions = useMemo(() => {
    const base = Array.isArray(availableRoles) ? availableRoles : [];
    const unique = new Set(base);
    if (userProfile?.role) {
      unique.add(userProfile.role);
    }
    return Array.from(unique);
  }, [availableRoles, userProfile?.role]);

  const userAppointments = useMemo(() => {
    if (!numericUserId || !Array.isArray(appointments)) {
      return [];
    }
    return appointments.filter((appointment) => appointment?.client?.id === numericUserId);
  }, [appointments, numericUserId]);

  const userAssets = useMemo(() => {
    const files = [];
    const notes = [];
    userAppointments.forEach((appointment) => {
      const assets = Array.isArray(appointment?.assets) ? appointment.assets : [];
      assets.forEach((asset) => {
        if (asset?.file_url) {
          files.push({ asset, appointment });
        }
        if (asset?.note_text) {
          notes.push({ asset, appointment });
        }
      });
    });
    return { files, notes };
  }, [userAppointments]);

  const totalFiles = userAssets.files.length;
  const totalNotes = userAssets.notes.length;
  const upcomingAppointments = userAppointments.filter((appointment) => {
    if (!appointment?.scheduled_start) {
      return false;
    }
    const start = new Date(appointment.scheduled_start);
    if (Number.isNaN(start.getTime())) {
      return false;
    }
    return start.getTime() > Date.now();
  }).length;

  const handleBackToSettings = () => {
    navigate('/dashboard/admin/settings');
  };

  const handleViewAppointment = (appointmentId) => {
    navigate(`/dashboard/admin/calendar/${appointmentId}`);
  };

  const handleRoleChange = async (event) => {
    const nextRole = event.target.value;
    if (!userProfile || !nextRole || nextRole === userProfile.role) {
      return;
    }
    setPendingRoleChange(true);
    try {
      await updateUserRole(userProfile.id, nextRole);
      setUserProfile((prev) => (prev ? { ...prev, role: nextRole } : prev));
    } catch (error) {
      // Notices are handled by the dashboard context; we simply keep the previous state.
    } finally {
      setPendingRoleChange(false);
    }
  };

  const roleSelectId = 'admin-user-role';

  if (!numericUserId) {
    return (
      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">User not found</h2>
        <p className="text-sm text-gray-600">
          The provided user identifier is invalid. Return to settings and select a user again.
        </p>
        <Button type="button" variant="secondary" onClick={handleBackToSettings}>
          Back to settings
        </Button>
      </Card>
    );
  }

  if (loadingUser) {
    return (
      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Loading user profile</h2>
        <p className="text-sm text-gray-600">Fetching the latest client information...</p>
      </Card>
    );
  }

  if (userError) {
    return (
      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Unable to display user</h2>
        <p className="text-sm text-gray-600">{userError}</p>
        <Button type="button" variant="secondary" onClick={handleBackToSettings}>
          Back to settings
        </Button>
      </Card>
    );
  }

  if (!userProfile) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionTitle
          eyebrow="User profile"
          title={userProfile.display_name || 'Client record'}
          description="Review contact details, appointments, files, and notes for this client."
        />
        <Button type="button" variant="secondary" onClick={handleBackToSettings}>
          Back to settings
        </Button>
      </div>

      <Card className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Contact</p>
          <div className="mt-3 grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-gray-400">Email</p>
              <p className="font-medium text-gray-900">{userProfile.email || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-gray-400">Phone</p>
              <p className="font-medium text-gray-900">{userProfile.phone || 'Not provided'}</p>
            </div>
            <div>
              <label
                htmlFor={roleOptions.length ? roleSelectId : undefined}
                className="text-xs uppercase tracking-[0.25em] text-gray-400"
              >
                Role
              </label>
              {roleOptions.length ? (
                <>
                  <select
                    id={roleSelectId}
                    value={userProfile.role || ''}
                    onChange={handleRoleChange}
                    disabled={pendingRoleChange}
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs uppercase tracking-[0.2em] text-gray-700 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-0"
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role} className="uppercase">
                        {role}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Updating the role adjusts the client&apos;s access level.
                  </p>
                </>
              ) : (
                <p className="mt-2 font-medium uppercase tracking-[0.2em] text-gray-900">
                  {userProfile.role || 'user'}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-gray-400">Member since</p>
              <p className="font-medium text-gray-900">{formatDate(userProfile.created_at)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-gray-400">Last seen</p>
              <p className="font-medium text-gray-900">
                {formatDateTime(userProfile.last_login_at, 'No login recorded')}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white/80 p-4 text-sm shadow-inner">
            <p className="text-xs uppercase tracking-[0.25em] text-gray-400">Appointments</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{userAppointments.length}</p>
            <p className="text-xs text-gray-500">Total recorded</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white/80 p-4 text-sm shadow-inner">
            <p className="text-xs uppercase tracking-[0.25em] text-gray-400">Upcoming</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{upcomingAppointments}</p>
            <p className="text-xs text-gray-500">Scheduled sessions</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white/80 p-4 text-sm shadow-inner">
            <p className="text-xs uppercase tracking-[0.25em] text-gray-400">Assets</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{totalFiles + totalNotes}</p>
            <p className="text-xs text-gray-500">Files & notes combined</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500">
              Past appointments
            </h3>
            <p className="text-sm text-gray-600">Review booking history and open appointment records.</p>
          </div>
          {userAppointments.length ? (
            <ul className="space-y-3">
              {userAppointments.map((appointment) => (
                <li
                  key={appointment.id}
                  className="rounded-xl border border-gray-200 p-4 text-sm text-gray-700 shadow-sm"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {appointment.reference_code || `Appointment #${appointment.id}`}
                      </p>
                      <p className="text-xs uppercase tracking-[0.25em] text-gray-400">
                        {appointment.status || 'unspecified'}
                      </p>
                    </div>
                    <Button type="button" variant="ghost" onClick={() => handleViewAppointment(appointment.id)}>
                      View appointment
                    </Button>
                  </div>
                  <dl className="mt-3 grid gap-2 text-xs text-gray-500 sm:grid-cols-2">
                    <div>
                      <dt className="uppercase tracking-[0.2em]">Scheduled</dt>
                      <dd className="text-gray-700">
                        {formatDateTime(appointment.scheduled_start, 'Not scheduled')}
                      </dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-[0.2em]">Duration</dt>
                      <dd className="text-gray-700">
                        {appointment.duration_minutes ? `${appointment.duration_minutes} minutes` : 'Not set'}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500">
              No appointments have been recorded for this user.
            </div>
          )}
        </Card>

        <Card className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500">
              Attached files
            </h3>
            <p className="text-sm text-gray-600">
              Documents and imagery uploaded for the user across appointments.
            </p>
          </div>
          {userAssets.files.length ? (
            <ul className="space-y-3">
              {userAssets.files.map(({ asset, appointment }) => (
                <li
                  key={asset.id}
                  className="rounded-xl border border-gray-200 p-4 text-sm text-gray-700 shadow-sm"
                >
                  <p className="text-sm font-semibold text-gray-900">
                    {normaliseAssetKind(asset.kind)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {appointment.reference_code || `Appointment #${appointment.id}`}
                  </p>
                  <a
                    href={resolveApiUrl(asset.file_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex text-xs font-semibold uppercase tracking-[0.25em] text-gray-900 transition hover:text-gray-600"
                  >
                    Open file
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500">
              No files have been attached to this user&apos;s appointments yet.
            </div>
          )}
        </Card>
      </div>

      <Card className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500">
            Notes
          </h3>
          <p className="text-sm text-gray-600">
            Internal annotations collected during the client journey.
          </p>
        </div>
        {userAssets.notes.length ? (
          <ul className="space-y-3">
            {userAssets.notes.map(({ asset, appointment }) => (
              <li
                key={asset.id}
                className="rounded-xl border border-gray-200 p-4 text-sm text-gray-700 shadow-sm"
              >
                <p className="text-xs uppercase tracking-[0.25em] text-gray-400">
                  {appointment.reference_code || `Appointment #${appointment.id}`}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{asset.note_text}</p>
                <p className="mt-2 text-xs text-gray-500">
                  Added on {formatDateTime(asset.created_at, 'Unknown date')}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500">
            No notes have been recorded for this user.
          </div>
        )}
      </Card>
    </div>
  );
}
