import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut, apiUpload } from '../../lib/api.js';

export const ASSET_KIND_OPTIONS = [
  { value: 'note', label: 'Admin note' },
  { value: 'inspiration_image', label: 'Reference image' },
  { value: 'document', label: 'Document' }
];

const AdminDashboardContext = createContext(null);

const NOTICE_DEFAULT_DURATION = 6000;
const DEFAULT_CACHE_TTL = 5 * 60_000;

export function getAdminResourcesForPath(path) {
  const resources = new Set(['dashboard']);
  if (!path) {
    return Array.from(resources);
  }
  if (path.includes('/dashboard/admin/calendar')) {
    resources.add('appointments');
    resources.add('schedule');
    resources.add('admins');
  }
  if (path.includes('/dashboard/admin/gallery')) {
    resources.add('gallery');
    resources.add('categories');
  }
  if (path.includes('/dashboard/admin/settings')) {
    resources.add('admins');
    resources.add('categories');
  }
  return Array.from(resources);
}

function ensureArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value;
}

function normalizeTone(tone) {
  switch (tone) {
    case 'success':
    case 'error':
    case 'warning':
    case 'info':
      return tone;
    case 'offline':
      return 'warning';
    case 'danger':
      return 'error';
    default:
      return 'info';
  }
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

function cloneSchedule(schedule) {
  return {
    operating_hours: ensureArray(schedule.operating_hours).map((entry) => ({ ...entry })),
    days_off: ensureArray(schedule.days_off).slice()
  };
}

export function AdminDashboardProvider({ children }) {
  const navigate = useNavigate();
  const { logout: authLogout } = useAuth();

  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [admins, setAdmins] = useState([]);
  const [categories, setCategories] = useState([]);
  const [galleryItems, setGalleryItems] = useState([]);
  const [galleryPagination, setGalleryPagination] = useState({
    page: 1,
    per_page: 50,
    total: 0,
    pages: 1
  });
  const [appointments, setAppointments] = useState([]);
  const [appointmentsPagination, setAppointmentsPagination] = useState({
    page: 1,
    per_page: 25,
    total: 0,
    pages: 1
  });
  const [overview, setOverview] = useState(null);
  const [recentUsers, setRecentUsers] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [activityTracking, setActivityTracking] = useState([]);
  const [analytics, setAnalytics] = useState({ appointments_by_status: {}, gallery_items_by_category: {} });
  const [settings, setSettings] = useState([]);
  const [schedule, setSchedule] = useState({ operating_hours: [], days_off: [] });

  const [notices, setNotices] = useState([]);
  const noticeIdRef = useRef(0);
  const cacheRef = useRef({});

  const markFetched = useCallback((key) => {
    cacheRef.current[key] = Date.now();
  }, []);

  const shouldFetch = useCallback(
    (key, ttl = DEFAULT_CACHE_TTL) => {
      const last = cacheRef.current[key];
      if (!last) {
        return true;
      }
      return Date.now() - last > ttl;
    },
    []
  );

  const showNotice = useCallback(
    ({ tone, message, autoHideAfter, id }) => {
      if (!message) {
        return null;
      }
      noticeIdRef.current += 1;
      const noticeId = id ?? `notice-${noticeIdRef.current}`;
      const entry = {
        id: noticeId,
        tone: normalizeTone(tone),
        message,
        autoHideAfter: autoHideAfter ?? NOTICE_DEFAULT_DURATION
      };
      setNotices((prev) => [...prev, entry]);
      return noticeId;
    },
    []
  );

  const dismissNotice = useCallback((id) => {
    setNotices((prev) => prev.filter((notice) => notice.id !== id));
  }, []);

  const clearFeedback = useCallback(() => {
    setNotices((prev) => prev.slice(1));
  }, []);

  const applyDashboard = useCallback((dashboard) => {
    if (!dashboard) {
      return;
    }
    setOverview(dashboard.overview || null);

    const userManagement = dashboard.user_management || {};
    setRecentUsers(ensureArray(userManagement.recent_users));
    setAvailableRoles(ensureArray(userManagement.available_roles));

    setActivityTracking(ensureArray(dashboard.activity_tracking));
    setAnalytics(dashboard.analytics || { appointments_by_status: {}, gallery_items_by_category: {} });
    setSettings(ensureArray(dashboard.system_settings));

    if (dashboard.admin) {
      setCurrentAdmin(dashboard.admin);
    }

    if (dashboard.content_control?.gallery_items) {
      setGalleryItems(ensureArray(dashboard.content_control.gallery_items));
    }
  }, []);

  const refreshDashboardMetrics = useCallback(async () => {
    const dashboard = await apiGet('/api/dashboard/admin');
    applyDashboard(dashboard);
    markFetched('dashboard');
    return dashboard;
  }, [applyDashboard, markFetched]);

  const refreshAdmins = useCallback(async () => {
    const response = await apiGet('/api/admin/admins');
    setAdmins(ensureArray(response));
    markFetched('admins');
    return response;
  }, [markFetched]);

  const refreshCategories = useCallback(async () => {
    const response = await apiGet('/api/admin/categories');
    setCategories(ensureArray(response));
    markFetched('categories');
    return response;
  }, [markFetched]);

  const refreshAppointments = useCallback(
    async ({ page = 1, perPage = appointmentsPagination.per_page, append = false } = {}) => {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('per_page', perPage);
      const response = await apiGet(`/api/admin/appointments?${params.toString()}`);
      const items = ensureArray(response?.items);
      setAppointments((prev) => (append && page > 1 ? [...prev, ...items] : items));
      setAppointmentsPagination({
        page,
        per_page: perPage,
        total: response?.meta?.total ?? items.length,
        pages: response?.meta?.pages ?? 1
      });
      markFetched('appointments');
      return response;
    },
    [appointmentsPagination.per_page, markFetched]
  );

  const loadMoreAppointments = useCallback(async () => {
    const nextPage = appointmentsPagination.page + 1;
    if (nextPage > appointmentsPagination.pages) {
      return;
    }
    await refreshAppointments({ page: nextPage, append: true });
  }, [appointmentsPagination.page, appointmentsPagination.pages, refreshAppointments]);

  const refreshSchedule = useCallback(async () => {
    const response = await apiGet('/api/admin/schedule');
    setSchedule({
      operating_hours: ensureArray(response?.operating_hours),
      days_off: ensureArray(response?.days_off)
    });
    markFetched('schedule');
    return response;
  }, [markFetched]);

  const refreshGalleryItems = useCallback(
    async ({ page = 1, perPage = galleryPagination.per_page, append = false } = {}) => {
      const params = new URLSearchParams();
      params.set('include_unpublished', 'true');
      params.set('page', page);
      params.set('per_page', perPage);
      const response = await apiGet(`/api/gallery?${params.toString()}`);
      const items = ensureArray(response?.items);
      setGalleryItems((prev) => (append && page > 1 ? [...prev, ...items] : items));
      setGalleryPagination({
        page,
        per_page: perPage,
        total: response?.meta?.total ?? items.length,
        pages: response?.meta?.pages ?? 1
      });
      markFetched('gallery');
      return response;
    },
    [galleryPagination.per_page, markFetched]
  );

  const loadMoreGalleryItems = useCallback(async () => {
    const nextPage = galleryPagination.page + 1;
    if (nextPage > galleryPagination.pages) {
      return;
    }
    await refreshGalleryItems({ page: nextPage, append: true });
  }, [galleryPagination.page, galleryPagination.pages, refreshGalleryItems]);

  const resourceLoaders = useMemo(
    () => ({
      dashboard: refreshDashboardMetrics,
      admins: refreshAdmins,
      categories: refreshCategories,
      appointments: refreshAppointments,
      schedule: refreshSchedule,
      gallery: refreshGalleryItems
    }),
    [refreshDashboardMetrics, refreshAdmins, refreshCategories, refreshAppointments, refreshSchedule, refreshGalleryItems]
  );

  const prefetchResources = useCallback(
    async (resources, { force = false, ttl = DEFAULT_CACHE_TTL } = {}) => {
      const tasks = resources.map((resource) => {
        const key = typeof resource === 'string' ? resource : resource.key;
        const resourceTtl = typeof resource === 'string' ? ttl : resource.ttl ?? ttl;
        if (!force && !shouldFetch(key, resourceTtl)) {
          return null;
        }
        const loader = resourceLoaders[key];
        if (!loader) {
          return null;
        }
        return loader().catch(() => {});
      });
      await Promise.all(tasks.filter(Boolean));
    },
    [resourceLoaders, shouldFetch]
  );

  useEffect(() => {
    let ignore = false;

    async function bootstrap() {
      setLoading(true);
      setError(null);
      try {
        const session = await apiGet('/api/auth/session');
        if (ignore) {
          return;
        }
        if (session?.role !== 'admin') {
          if (!ignore) {
            setLoading(false);
          }
          navigate('/auth', { replace: true });
          return;
        }
        setCurrentAdmin(session.account);

        const initialPath = window.location?.pathname ?? '/dashboard/admin';
        const initialResources = getAdminResourcesForPath(initialPath).filter((resource) => resource !== 'dashboard');
        cacheRef.current.dashboard = Date.now();
        refreshDashboardMetrics().catch((err) => {
          if (ignore) {
            return;
          }
          delete cacheRef.current.dashboard;
          if (err?.status === 401) {
            navigate('/auth', { replace: true });
          } else {
            setError('Unable to load admin dashboard.');
          }
        });
        if (initialResources.length) {
          prefetchResources(initialResources, { force: true }).catch(() => {});
        }
        if (!ignore) {
          setLoading(false);
        }
      } catch (err) {
        if (ignore) {
          return;
        }
        if (err.status === 401) {
          navigate('/auth', { replace: true });
        } else {
          setError('Unable to load admin dashboard.');
        }
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      ignore = true;
    };
  }, [navigate, refreshDashboardMetrics, prefetchResources]);

  const logout = useCallback(async () => {
    await authLogout();
    navigate('/auth', { replace: true });
  }, [authLogout, navigate]);

  const updateUserRole = useCallback(
    async (userId, role) => {
      const previousUsers = recentUsers;
      setRecentUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, role } : user)));
      try {
        await apiPatch(`/api/admin/users/${userId}/role`, { role });
        showNotice({ tone: 'success', message: 'Role updated.' });
        markFetched('dashboard');
        refreshDashboardMetrics().catch(() => {});
      } catch (err) {
        setRecentUsers(previousUsers);
        showNotice({ tone: 'error', message: getErrorMessage(err, 'Unable to update role.') });
        throw err;
      }
    },
    [recentUsers, refreshDashboardMetrics, showNotice, markFetched]
  );

  const createCategory = useCallback(
    async (payload) => {
      const tempId = `temp-category-${Date.now()}`;
      const optimisticCategory = {
        id: tempId,
        name: payload.name?.trim() || 'Untitled',
        description: payload.description?.trim() || null,
        is_active: payload.is_active ?? true,
        gallery_item_count: 0,
        optimistic: true
      };
      setCategories((prev) => [optimisticCategory, ...prev]);
      markFetched('categories');
      try {
        const created = await apiPost('/api/admin/categories', payload);
        setCategories((prev) => prev.map((category) => (category.id === tempId ? created : category)));
        showNotice({ tone: 'success', message: 'Category created.' });
        refreshDashboardMetrics().catch(() => {});
        return created;
      } catch (err) {
        setCategories((prev) => prev.filter((category) => category.id !== tempId));
        showNotice({ tone: 'error', message: getErrorMessage(err, 'Unable to create category.') });
        throw err;
      }
    },
    [showNotice, refreshDashboardMetrics, markFetched]
  );

  const updateCategory = useCallback(
    async (categoryId, payload) => {
      const previousCategories = categories;
      setCategories((prev) =>
        prev.map((category) =>
          category.id === categoryId ? { ...category, ...payload, description: payload.description ?? category.description } : category
        )
      );
      try {
        const updated = await apiPatch(`/api/admin/categories/${categoryId}`, payload);
        setCategories((prev) => prev.map((category) => (category.id === categoryId ? updated : category)));
        showNotice({ tone: 'success', message: 'Category updated.' });
        markFetched('categories');
        refreshDashboardMetrics().catch(() => {});
      } catch (err) {
        setCategories(previousCategories);
        showNotice({ tone: 'error', message: getErrorMessage(err, 'Unable to update category.') });
        throw err;
      }
    },
    [categories, showNotice, refreshDashboardMetrics, markFetched]
  );

  const toggleCategoryVisibility = useCallback(
    async (categoryId, isActive) => {
      const previousCategories = categories;
      setCategories((prev) =>
        prev.map((category) => (category.id === categoryId ? { ...category, is_active: isActive } : category))
      );
      try {
        const updated = await apiPatch(`/api/admin/categories/${categoryId}`, { is_active: isActive });
        setCategories((prev) => prev.map((category) => (category.id === categoryId ? updated : category)));
        showNotice({ tone: 'success', message: `Category ${isActive ? 'activated' : 'hidden'}.` });
        markFetched('categories');
      } catch (err) {
        setCategories(previousCategories);
        showNotice({ tone: 'error', message: getErrorMessage(err, 'Unable to update category visibility.') });
        throw err;
      }
    },
    [categories, showNotice, markFetched]
  );

  const deleteCategory = useCallback(
    async (categoryId) => {
      const previousCategories = categories;
      setCategories((prev) => prev.filter((category) => category.id !== categoryId));
      try {
        await apiDelete(`/api/admin/categories/${categoryId}`);
        showNotice({ tone: 'success', message: 'Category deleted.' });
        markFetched('categories');
      } catch (err) {
        setCategories(previousCategories);
        showNotice({ tone: 'error', message: getErrorMessage(err, 'Unable to delete category.') });
        throw err;
      }
    },
    [categories, showNotice, markFetched]
  );

  const uploadMedia = useCallback(async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiUpload('/api/admin/uploads', formData);
  }, []);

  const createGalleryItem = useCallback(
    async (payload) => {
      const tempId = `temp-gallery-${Date.now()}`;
      const optimisticItem = {
        id: tempId,
        ...payload,
        is_published: payload.is_published ?? true,
        optimistic: true
      };
      setGalleryItems((prev) => [optimisticItem, ...prev]);
      setGalleryPagination((prev) => ({
        ...prev,
        total: prev.total + 1
      }));
      markFetched('gallery');
      try {
        const created = await apiPost('/api/admin/gallery', payload);
        setGalleryItems((prev) => prev.map((item) => (item.id === tempId ? created : item)));
        showNotice({ tone: 'success', message: 'Gallery item created.' });
        refreshDashboardMetrics().catch(() => {});
        return created;
      } catch (err) {
        setGalleryItems((prev) => prev.filter((item) => item.id !== tempId));
        showNotice({ tone: 'error', message: getErrorMessage(err, 'Unable to create gallery item.') });
        throw err;
      }
    },
    [showNotice, refreshDashboardMetrics, markFetched]
  );

  const updateGalleryItem = useCallback(
    async (itemId, payload) => {
      const previousItems = galleryItems;
      setGalleryItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, ...payload } : item))
      );
      try {
        const updated = await apiPatch(`/api/admin/gallery/${itemId}`, payload);
        setGalleryItems((prev) => prev.map((item) => (item.id === itemId ? updated : item)));
        showNotice({ tone: 'success', message: 'Gallery item updated.' });
        markFetched('gallery');
      } catch (err) {
        setGalleryItems(previousItems);
        showNotice({ tone: 'error', message: getErrorMessage(err, 'Unable to update gallery item.') });
        throw err;
      }
    },
    [galleryItems, showNotice, markFetched]
  );

  const deleteGalleryItem = useCallback(
    async (itemId) => {
      const previousItems = galleryItems;
      setGalleryItems((prev) => prev.filter((item) => item.id !== itemId));
      setGalleryPagination((prev) => ({
        ...prev,
        total: Math.max(0, prev.total - 1)
      }));
      try {
        await apiDelete(`/api/admin/gallery/${itemId}`);
        showNotice({ tone: 'success', message: 'Gallery item removed.' });
        markFetched('gallery');
      } catch (err) {
        setGalleryItems(previousItems);
        setGalleryPagination((prev) => ({
          ...prev,
          total: prev.total + 1
        }));
        showNotice({ tone: 'error', message: getErrorMessage(err, 'Unable to delete gallery item.') });
        throw err;
      }
    },
    [galleryItems, showNotice, markFetched]
  );

  const createAppointment = useCallback(
    async (payload) => {
      const tempId = `temp-appointment-${Date.now()}`;
      const optimisticAppointment = {
        id: tempId,
        ...payload,
        status: payload.status || 'pending',
        assets: [],
        optimistic: true
      };
      setAppointments((prev) => [optimisticAppointment, ...prev]);
      setAppointmentsPagination((prev) => ({
        ...prev,
        total: prev.total + 1
      }));
      markFetched('appointments');
      try {
        const appointment = await apiPost('/api/admin/appointments', payload);
        setAppointments((prev) => prev.map((entry) => (entry.id === tempId ? appointment : entry)));
        showNotice({ tone: 'success', message: 'Appointment created.' });
        refreshDashboardMetrics().catch(() => {});
        return appointment;
      } catch (err) {
        setAppointments((prev) => prev.filter((entry) => entry.id !== tempId));
        setAppointmentsPagination((prev) => ({
          ...prev,
          total: Math.max(0, prev.total - 1)
        }));
        showNotice({ tone: 'error', message: getErrorMessage(err, 'Unable to create appointment.') });
        throw err;
      }
    },
    [showNotice, refreshDashboardMetrics, markFetched]
  );

  const updateAppointment = useCallback(
    async (appointmentId, payload) => {
      const previousAppointments = appointments;
      setAppointments((prev) =>
        prev.map((appointment) =>
          appointment.id === appointmentId
            ? {
                ...appointment,
                ...payload,
                scheduled_start: payload.scheduled_start ?? appointment.scheduled_start,
                duration_minutes: payload.duration_minutes ?? appointment.duration_minutes
              }
            : appointment
        )
      );
      try {
        const updated = await apiPatch(`/api/admin/appointments/${appointmentId}`, payload);
        setAppointments((prev) => prev.map((appointment) => (appointment.id === appointmentId ? updated : appointment)));
        showNotice({ tone: 'success', message: 'Appointment updated.' });
        markFetched('appointments');
        refreshDashboardMetrics().catch(() => {});
      } catch (err) {
        setAppointments(previousAppointments);
        showNotice({ tone: 'error', message: getErrorMessage(err, 'Unable to update appointment.') });
        throw err;
      }
    },
    [appointments, showNotice, refreshDashboardMetrics, markFetched]
  );

  const deleteAppointment = useCallback(
    async (appointmentId) => {
      const previousAppointments = appointments;
      setAppointments((prev) => prev.filter((appointment) => appointment.id !== appointmentId));
      setAppointmentsPagination((prev) => ({
        ...prev,
        total: Math.max(0, prev.total - 1)
      }));
      try {
        await apiDelete(`/api/admin/appointments/${appointmentId}`);
        showNotice({ tone: 'success', message: 'Appointment deleted.' });
        markFetched('appointments');
        refreshDashboardMetrics().catch(() => {});
      } catch (err) {
        setAppointments(previousAppointments);
        setAppointmentsPagination((prev) => ({
          ...prev,
          total: prev.total + 1
        }));
        showNotice({ tone: 'error', message: getErrorMessage(err, 'Unable to delete appointment.') });
        throw err;
      }
    },
    [appointments, showNotice, refreshDashboardMetrics, markFetched]
  );

  const createAppointmentAsset = useCallback(
    async (appointmentId, payload) => {
      const tempId = `temp-asset-${Date.now()}`;
      const optimisticAsset = {
        id: tempId,
        kind: payload.kind,
        file_url: payload.file_url,
        note_text: payload.note_text,
        is_visible_to_client: payload.is_visible_to_client,
        created_at: new Date().toISOString(),
        uploaded_by_admin: payload.uploaded_by_admin_id ? currentAdmin : null,
        uploaded_by_client: null,
        optimistic: true
      };
      setAppointments((prev) =>
        prev.map((appointment) => {
          if (appointment.id !== appointmentId) {
            return appointment;
          }
          const assets = Array.isArray(appointment.assets) ? [optimisticAsset, ...appointment.assets] : [optimisticAsset];
          return { ...appointment, assets };
        })
      );
      markFetched('appointments');
      try {
        const asset = await apiPost(`/api/admin/appointments/${appointmentId}/assets`, payload);
        setAppointments((prev) =>
          prev.map((appointment) => {
            if (appointment.id !== appointmentId) {
              return appointment;
            }
            const assets = Array.isArray(appointment.assets)
              ? appointment.assets.map((entry) => (entry.id === tempId ? asset : entry))
              : [asset];
            return { ...appointment, assets };
          })
        );
        showNotice({ tone: 'success', message: 'Asset attached to appointment.' });
        refreshAppointments().catch(() => {});
        return asset;
      } catch (err) {
        setAppointments((prev) =>
          prev.map((appointment) => {
            if (appointment.id !== appointmentId) {
              return appointment;
            }
            const assets = Array.isArray(appointment.assets)
              ? appointment.assets.filter((entry) => entry.id !== tempId)
              : [];
            return { ...appointment, assets };
          })
        );
        showNotice({ tone: 'error', message: getErrorMessage(err, 'Unable to add asset.') });
        throw err;
      }
    },
    [currentAdmin, showNotice, refreshAppointments, markFetched]
  );

  const toggleAppointmentAssetVisibility = useCallback(
    async (appointmentId, assetId, isVisible) => {
      const previousAppointments = appointments;
      setAppointments((prev) =>
        prev.map((appointment) => {
          if (appointment.id !== appointmentId) {
            return appointment;
          }
          const assets = Array.isArray(appointment.assets)
            ? appointment.assets.map((asset) =>
                asset.id === assetId ? { ...asset, is_visible_to_client: isVisible } : asset
              )
            : [];
          return { ...appointment, assets };
        })
      );
      try {
        await apiPatch(`/api/admin/appointments/${appointmentId}/assets/${assetId}`, {
          is_visible_to_client: isVisible
        });
        showNotice({
          tone: 'success',
          message: `Asset ${isVisible ? 'shared with client' : 'hidden from client'}.`
        });
        markFetched('appointments');
      } catch (err) {
        setAppointments(previousAppointments);
        showNotice({ tone: 'error', message: getErrorMessage(err, 'Unable to update asset visibility.') });
        throw err;
      }
    },
    [appointments, showNotice, markFetched]
  );

  const updateSchedule = useCallback(
    async (payload) => {
      const previousSchedule = cloneSchedule(schedule);
      setSchedule({
        operating_hours: ensureArray(payload?.operating_hours ?? schedule.operating_hours),
        days_off: ensureArray(payload?.days_off ?? schedule.days_off)
      });
      try {
        const response = await apiPut('/api/admin/schedule', payload);
        setSchedule({
          operating_hours: ensureArray(response?.operating_hours),
          days_off: ensureArray(response?.days_off)
        });
        showNotice({ tone: 'success', message: 'Schedule updated.' });
        markFetched('schedule');
        return response;
      } catch (err) {
        setSchedule(previousSchedule);
        showNotice({ tone: 'error', message: getErrorMessage(err, 'Unable to update schedule.') });
        throw err;
      }
    },
    [schedule, showNotice, markFetched]
  );

  const value = useMemo(
    () => ({
      state: {
        currentAdmin,
        loading,
        error,
        notices,
        overview,
        recentUsers,
        availableRoles,
        activityTracking,
        analytics,
        settings,
        admins,
        categories,
        galleryItems,
        galleryPagination,
        appointments,
        appointmentsPagination,
        schedule
      },
      actions: {
        showNotice,
        dismissNotice,
        setFeedback: showNotice,
        clearFeedback,
        prefetchResources,
        refreshDashboardMetrics,
        refreshAdmins,
        refreshCategories,
        refreshAppointments,
        refreshGalleryItems,
        refreshSchedule,
        loadMoreAppointments,
        loadMoreGalleryItems,
        logout,
        updateUserRole,
        createCategory,
        updateCategory,
        toggleCategoryVisibility,
        deleteCategory,
        uploadMedia,
        createGalleryItem,
        updateGalleryItem,
        deleteGalleryItem,
        createAppointment,
        updateAppointment,
        deleteAppointment,
        createAppointmentAsset,
        toggleAppointmentAssetVisibility,
        updateSchedule
      }
    }),
    [
      currentAdmin,
      loading,
      error,
      notices,
      overview,
      recentUsers,
      availableRoles,
      activityTracking,
      analytics,
      settings,
      admins,
      categories,
      galleryItems,
      galleryPagination,
      appointments,
      appointmentsPagination,
      schedule,
      showNotice,
      dismissNotice,
      clearFeedback,
      prefetchResources,
      refreshDashboardMetrics,
      refreshAdmins,
      refreshCategories,
      refreshAppointments,
      refreshGalleryItems,
      refreshSchedule,
      loadMoreAppointments,
      loadMoreGalleryItems,
      logout,
      updateUserRole,
      createCategory,
      updateCategory,
      toggleCategoryVisibility,
      deleteCategory,
      uploadMedia,
      createGalleryItem,
      updateGalleryItem,
      deleteGalleryItem,
      createAppointment,
      updateAppointment,
      deleteAppointment,
      createAppointmentAsset,
      toggleAppointmentAssetVisibility,
      updateSchedule
    ]
  );

  return <AdminDashboardContext.Provider value={value}>{children}</AdminDashboardContext.Provider>;
}

export function useAdminDashboard() {
  const context = useContext(AdminDashboardContext);
  if (!context) {
    throw new Error('useAdminDashboard must be used within an AdminDashboardProvider');
  }
  return context;
}
