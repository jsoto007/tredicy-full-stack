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
    resources.add('reservations');
    resources.add('schedule');
    resources.add('admins');
  }
  if (path.includes('/dashboard/admin/gallery')) {
    resources.add('gallery');
    resources.add('categories');
  }
  if (path.includes('/dashboard/admin/user/')) {
    resources.add('reservations');
    resources.add('users');
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
    days_off: ensureArray(schedule.days_off).slice(),
    closures: ensureArray(schedule.closures).map((entry) => ({ ...entry }))
  };
}

export function AdminDashboardProvider({ children }) {
  const navigate = useNavigate();
  const { logout: authLogout } = useAuth();

  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [admins, setAdmins] = useState([]);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [galleryItems, setGalleryItems] = useState([]);
  const [galleryPagination, setGalleryPagination] = useState({
    page: 1,
    per_page: 50,
    total: 0,
    pages: 1
  });
  const [reservations, setReservations] = useState([]);
  const [reservationsPagination, setReservationsPagination] = useState({
    page: 1,
    per_page: 25,
    total: 0,
    pages: 1
  });
  const [reservationsLoading, setReservationsLoading] = useState(false);
  const [overview, setOverview] = useState(null);
  const [recentUsers, setRecentUsers] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [activityTracking, setActivityTracking] = useState([]);
  const [analytics, setAnalytics] = useState({ reservations_by_status: {}, gallery_items_by_category: {} });
  const [settings, setSettings] = useState([]);
  const [schedule, setSchedule] = useState({ operating_hours: [], days_off: [], closures: [] });
  const [pricing, setPricing] = useState({
    hourly_rate_cents: null,
    currency: 'USD',
    booking_fee_percent: null,
    session_options: [],
  });

  const [notices, setNotices] = useState([]);
  const noticeIdRef = useRef(0);
  const cacheRef = useRef({});
  const pendingResourceLoadsRef = useRef(new Map());
  const reservationsLengthRef = useRef(reservations.length);

  useEffect(() => {
    reservationsLengthRef.current = reservations.length;
  }, [reservations.length]);

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
    setAnalytics(dashboard.analytics || { reservations_by_status: {}, gallery_items_by_category: {} });
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

  const refreshUsers = useCallback(async () => {
    const response = await apiGet('/api/admin/users');
    setUsers(ensureArray(response));
    markFetched('users');
    return response;
  }, [markFetched]);

  const refreshCategories = useCallback(async () => {
    const response = await apiGet('/api/admin/categories');
    setCategories(ensureArray(response));
    markFetched('categories');
    return response;
  }, [markFetched]);

  const refreshReservations = useCallback(
    async ({ page = 1, perPage = reservationsPagination.per_page, append = false } = {}) => {
      const isInitialLoad = !append && reservationsLengthRef.current === 0;
      if (isInitialLoad) {
        setReservationsLoading(true);
      }
      try {
        const params = new URLSearchParams();
        params.set('page', page);
        params.set('per_page', perPage);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);
        const response = await apiGet(`/api/admin/reservations?${params.toString()}`, {
          signal: controller.signal
        }).finally(() => {
          clearTimeout(timeout);
        });
        // Support both paginated payloads ({ items, meta }) and legacy array payloads.
        const items = ensureArray(
          Array.isArray(response) ? response : response?.items ?? response?.reservations
        );
        const meta = !Array.isArray(response) && response?.meta ? response.meta : null;
        setReservations((prev) => (append && page > 1 ? [...prev, ...items] : items));
        setReservationsPagination({
          page: meta?.page ?? page,
          per_page: meta?.per_page ?? perPage,
          total: meta?.total ?? items.length,
          pages: meta?.pages ?? 1
        });
        markFetched('reservations');
        return response;
      } catch (err) {
        if (err?.name === 'AbortError') {
          showNotice({ tone: 'error', message: 'Reservations request timed out. Please retry.' });
        } else {
          showNotice({ tone: 'error', message: getErrorMessage(err, 'Unable to load reservations.') });
        }
        throw err;
      } finally {
        if (isInitialLoad) {
          setReservationsLoading(false);
        }
      }
    },
    [reservationsPagination.per_page, markFetched, showNotice]
  );

  const loadMoreReservations = useCallback(async () => {
    const nextPage = reservationsPagination.page + 1;
    if (nextPage > reservationsPagination.pages) {
      return;
    }
    await refreshReservations({ page: nextPage, append: true });
  }, [reservationsPagination.page, reservationsPagination.pages, refreshReservations]);

  const refreshSchedule = useCallback(async () => {
    const response = await apiGet('/api/admin/schedule');
    setSchedule({
      operating_hours: ensureArray(response?.operating_hours),
      days_off: ensureArray(response?.days_off),
      closures: ensureArray(response?.closures)
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

  const refreshHourlyRate = useCallback(async () => {
    const response = await apiGet('/api/pricing/hourly-rate');
    setPricing({
      hourly_rate_cents: response?.hourly_rate_cents ?? null,
      currency: response?.currency ?? 'USD',
      booking_fee_percent: response?.booking_fee_percent ?? null,
      session_options: Array.isArray(response?.session_options) ? response.session_options : [],
    });
    markFetched('pricing');
    return response;
  }, [markFetched]);

  const updateHourlyRate = useCallback(
    async (hourly_rate_cents) => {
      try {
        const response = await apiPut('/api/admin/settings/hourly-rate', {
          hourly_rate_cents
        });
        await refreshHourlyRate();
        showNotice({ tone: 'success', message: 'Hourly rate updated.' });
        refreshDashboardMetrics().catch(() => {});
        return response;
      } catch (err) {
        showNotice({ tone: 'error', message: getErrorMessage(err, 'Unable to update hourly rate.') });
        throw err;
      }
    },
    [refreshHourlyRate, refreshDashboardMetrics, showNotice]
  );

  const createSessionOption = useCallback(
    async (payload) => {
      try {
        const response = await apiPost('/api/admin/pricing/session-options', payload);
        showNotice({ tone: 'success', message: 'Product created.' });
        markFetched('pricing');
        refreshHourlyRate().catch(() => {});
        return response;
      } catch (err) {
        showNotice({ tone: 'error', message: getErrorMessage(err, 'Unable to save product.') });
        throw err;
      }
    },
    [refreshHourlyRate, showNotice, markFetched]
  );

  const updateSessionOption = useCallback(
    async (sessionOptionId, payload) => {
      try {
        const response = await apiPatch(`/api/admin/pricing/session-options/${sessionOptionId}`, payload);
        showNotice({ tone: 'success', message: 'Product updated.' });
        markFetched('pricing');
        refreshHourlyRate().catch(() => {});
        return response;
      } catch (err) {
        showNotice({ tone: 'error', message: getErrorMessage(err, 'Unable to update product.') });
        throw err;
      }
    },
    [refreshHourlyRate, showNotice, markFetched]
  );

  const deleteSessionOption = useCallback(
    async (sessionOptionId) => {
      try {
        const response = await apiDelete(`/api/admin/pricing/session-options/${sessionOptionId}`);
        showNotice({ tone: 'success', message: 'Product removed.' });
        markFetched('pricing');
        refreshHourlyRate().catch(() => {});
        return response;
      } catch (err) {
        showNotice({ tone: 'error', message: getErrorMessage(err, 'Unable to remove product.') });
        throw err;
      }
    },
    [refreshHourlyRate, showNotice, markFetched]
  );

  const updateBookingFee = useCallback(
    async (percent) => {
      try {
        const response = await apiPut('/api/admin/pricing/booking-fee', {
          booking_fee_percent: percent
        });
        setPricing((prev) => ({
          ...prev,
          booking_fee_percent: response?.booking_fee_percent ?? percent
        }));
        showNotice({ tone: 'success', message: 'Booking fee updated.' });
        markFetched('pricing');
        refreshHourlyRate().catch(() => {});
        return response;
      } catch (err) {
        showNotice({ tone: 'error', message: getErrorMessage(err, 'Unable to update booking fee.') });
        throw err;
      }
    },
    [refreshHourlyRate, showNotice, markFetched]
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
      users: refreshUsers,
      categories: refreshCategories,
      reservations: refreshReservations,
      schedule: refreshSchedule,
      pricing: refreshHourlyRate,
      gallery: refreshGalleryItems
    }),
    [
      refreshDashboardMetrics,
      refreshAdmins,
      refreshUsers,
      refreshCategories,
      refreshReservations,
      refreshSchedule,
      refreshHourlyRate,
      refreshGalleryItems
    ]
  );

  const enqueueResourceLoad = useCallback((key, loader) => {
    if (!loader) {
      return null;
    }
    const pending = pendingResourceLoadsRef.current.get(key);
    if (pending) {
      return pending;
    }
    const promise = loader().finally(() => {
      pendingResourceLoadsRef.current.delete(key);
    });
    pendingResourceLoadsRef.current.set(key, promise);
    return promise;
  }, []);

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
        const loadPromise = enqueueResourceLoad(key, loader);
        if (!loadPromise) {
          return null;
        }
        return loadPromise.catch(() => {});
      });
      await Promise.all(tasks.filter(Boolean));
    },
    [resourceLoaders, shouldFetch, enqueueResourceLoad]
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
    // Redirect to landing and force reload to clear any cached state.
    window.location.href = '/';
  }, [authLogout]);

  const updateUserRole = useCallback(
    async (userId, role) => {
      const previousRecentUsers = recentUsers;
      const previousUsers = users;
      setRecentUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, role } : user)));
      setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, role } : user)));
      try {
        await apiPatch(`/api/admin/users/${userId}/role`, { role });
        showNotice({ tone: 'success', message: 'Role updated.' });
        markFetched('dashboard');
        markFetched('users');
        refreshDashboardMetrics().catch(() => {});
        refreshUsers().catch(() => {});
      } catch (err) {
        setRecentUsers(previousRecentUsers);
        setUsers(previousUsers);
        showNotice({ tone: 'error', message: getErrorMessage(err, 'Unable to update role.') });
        throw err;
      }
    },
    [recentUsers, users, refreshDashboardMetrics, refreshUsers, showNotice, markFetched]
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

  const createReservation = useCallback(
    async (payload) => {
      const tempId = `temp-reservation-${Date.now()}`;
      const optimisticReservation = {
        id: tempId,
        ...payload,
        status: payload.status || 'pending',
        assets: [],
        optimistic: true
      };
      setReservations((prev) => [optimisticReservation, ...prev]);
      setReservationsPagination((prev) => ({
        ...prev,
        total: prev.total + 1
      }));
      markFetched('reservations');
      try {
        const reservation = await apiPost('/api/admin/reservations', payload);
        setReservations((prev) => prev.map((entry) => (entry.id === tempId ? reservation : entry)));
        showNotice({ tone: 'success', message: 'Reservation created.' });
        refreshDashboardMetrics().catch(() => {});
        return reservation;
      } catch (err) {
        setReservations((prev) => prev.filter((entry) => entry.id !== tempId));
        setReservationsPagination((prev) => ({
          ...prev,
          total: Math.max(0, prev.total - 1)
        }));
        showNotice({ tone: 'error', message: getErrorMessage(err, 'Unable to create reservation.') });
        throw err;
      }
    },
    [showNotice, refreshDashboardMetrics, markFetched]
  );

  const updateReservation = useCallback(
    async (reservationId, payload) => {
      const previousReservations = reservations;
      setReservations((prev) =>
        prev.map((reservation) =>
          reservation.id === reservationId
            ? {
                ...reservation,
                ...payload,
                scheduled_start: payload.scheduled_start ?? reservation.scheduled_start,
                duration_minutes: payload.duration_minutes ?? reservation.duration_minutes
              }
            : reservation
        )
      );
      try {
        const updated = await apiPatch(`/api/admin/reservations/${reservationId}`, payload);
        setReservations((prev) => prev.map((reservation) => (reservation.id === reservationId ? updated : reservation)));
        showNotice({ tone: 'success', message: 'Reservation updated.' });
        markFetched('reservations');
        refreshDashboardMetrics().catch(() => {});
      } catch (err) {
        setReservations(previousReservations);
        showNotice({ tone: 'error', message: getErrorMessage(err, 'Unable to update reservation.') });
        throw err;
      }
    },
    [reservations, showNotice, refreshDashboardMetrics, markFetched]
  );

  const deleteReservation = useCallback(
    async (reservationId) => {
      const previousReservations = reservations;
      setReservations((prev) => prev.filter((reservation) => reservation.id !== reservationId));
      setReservationsPagination((prev) => ({
        ...prev,
        total: Math.max(0, prev.total - 1)
      }));
      try {
        await apiDelete(`/api/admin/reservations/${reservationId}`);
        showNotice({ tone: 'success', message: 'Reservation deleted.' });
        markFetched('reservations');
        refreshDashboardMetrics().catch(() => {});
      } catch (err) {
        setReservations(previousReservations);
        setReservationsPagination((prev) => ({
          ...prev,
          total: prev.total + 1
        }));
        showNotice({ tone: 'error', message: getErrorMessage(err, 'Unable to delete reservation.') });
        throw err;
      }
    },
    [reservations, showNotice, refreshDashboardMetrics, markFetched]
  );

  const createReservationAsset = useCallback(
    async (reservationId, payload) => {
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
      setReservations((prev) =>
        prev.map((reservation) => {
          if (reservation.id !== reservationId) {
            return reservation;
          }
          const assets = Array.isArray(reservation.assets) ? [optimisticAsset, ...reservation.assets] : [optimisticAsset];
          return { ...reservation, assets };
        })
      );
      markFetched('reservations');
      try {
        const asset = await apiPost(`/api/admin/reservations/${reservationId}/assets`, payload);
        setReservations((prev) =>
          prev.map((reservation) => {
            if (reservation.id !== reservationId) {
              return reservation;
            }
            const assets = Array.isArray(reservation.assets)
              ? reservation.assets.map((entry) => (entry.id === tempId ? asset : entry))
              : [asset];
            return { ...reservation, assets };
          })
        );
        showNotice({ tone: 'success', message: 'Asset attached to reservation.' });
        refreshReservations().catch(() => {});
        return asset;
      } catch (err) {
        setReservations((prev) =>
          prev.map((reservation) => {
            if (reservation.id !== reservationId) {
              return reservation;
            }
            const assets = Array.isArray(reservation.assets)
              ? reservation.assets.filter((entry) => entry.id !== tempId)
              : [];
            return { ...reservation, assets };
          })
        );
        showNotice({ tone: 'error', message: getErrorMessage(err, 'Unable to add asset.') });
        throw err;
      }
    },
    [currentAdmin, showNotice, refreshReservations, markFetched]
  );

  const toggleReservationAssetVisibility = useCallback(
    async (reservationId, assetId, isVisible) => {
      const previousReservations = reservations;
      setReservations((prev) =>
        prev.map((reservation) => {
          if (reservation.id !== reservationId) {
            return reservation;
          }
          const assets = Array.isArray(reservation.assets)
            ? reservation.assets.map((asset) =>
                asset.id === assetId ? { ...asset, is_visible_to_client: isVisible } : asset
              )
            : [];
          return { ...reservation, assets };
        })
      );
      try {
        await apiPatch(`/api/admin/reservations/${reservationId}/assets/${assetId}`, {
          is_visible_to_client: isVisible
        });
        showNotice({
          tone: 'success',
          message: `Asset ${isVisible ? 'shared with client' : 'hidden from client'}.`
        });
        markFetched('reservations');
      } catch (err) {
        setReservations(previousReservations);
        showNotice({ tone: 'error', message: getErrorMessage(err, 'Unable to update asset visibility.') });
        throw err;
      }
    },
    [reservations, showNotice, markFetched]
  );

  const updateSchedule = useCallback(
    async (payload) => {
      const previousSchedule = cloneSchedule(schedule);
      setSchedule({
        operating_hours: ensureArray(payload?.operating_hours ?? schedule.operating_hours),
        days_off: ensureArray(payload?.days_off ?? schedule.days_off),
        closures: ensureArray(payload?.closures ?? schedule.closures)
      });
      try {
        const response = await apiPut('/api/admin/schedule', payload);
        setSchedule({
          operating_hours: ensureArray(response?.operating_hours),
          days_off: ensureArray(response?.days_off),
          closures: ensureArray(response?.closures)
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

  const createClosure = useCallback(
    async (payload) => {
      try {
        const response = await apiPost('/api/admin/schedule/closures', payload);
        await refreshSchedule();
        showNotice({ tone: 'success', message: 'Closure saved.' });
        return response;
      } catch (err) {
        showNotice({ tone: 'error', message: getErrorMessage(err, 'Unable to add closure.') });
        throw err;
      }
    },
    [refreshSchedule, showNotice]
  );

  const updateClosure = useCallback(
    async (closureId, payload) => {
      try {
        const response = await apiPatch(`/api/admin/schedule/closures/${closureId}`, payload);
        await refreshSchedule();
        showNotice({ tone: 'success', message: 'Closure updated.' });
        return response;
      } catch (err) {
        showNotice({ tone: 'error', message: getErrorMessage(err, 'Unable to update closure.') });
        throw err;
      }
    },
    [refreshSchedule, showNotice]
  );

  const deleteClosure = useCallback(
    async (closureId) => {
      try {
        await apiDelete(`/api/admin/schedule/closures/${closureId}`);
        await refreshSchedule();
        showNotice({ tone: 'success', message: 'Closure removed.' });
      } catch (err) {
        showNotice({ tone: 'error', message: getErrorMessage(err, 'Unable to remove closure.') });
        throw err;
      }
    },
    [refreshSchedule, showNotice]
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
        users,
        categories,
        galleryItems,
        galleryPagination,
        reservations,
        reservationsPagination,
        schedule,
        pricing,
        reservationsLoading
      },
      actions: {
        showNotice,
        dismissNotice,
        setFeedback: showNotice,
        clearFeedback,
        prefetchResources,
        refreshDashboardMetrics,
        refreshAdmins,
        refreshUsers,
        refreshCategories,
        refreshReservations,
        refreshGalleryItems,
        refreshSchedule,
        refreshHourlyRate,
        updateHourlyRate,
        createSessionOption,
        updateSessionOption,
        deleteSessionOption,
        updateBookingFee,
        loadMoreReservations,
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
        createReservation,
        updateReservation,
        deleteReservation,
        createReservationAsset,
        toggleReservationAssetVisibility,
        updateSchedule,
        createClosure,
        updateClosure,
        deleteClosure
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
      users,
      categories,
      galleryItems,
      galleryPagination,
      reservations,
      reservationsPagination,
      reservationsLoading,
      schedule,
      pricing,
      showNotice,
      dismissNotice,
      clearFeedback,
      prefetchResources,
      refreshDashboardMetrics,
      refreshAdmins,
      refreshUsers,
      refreshCategories,
      refreshReservations,
      refreshGalleryItems,
      refreshSchedule,
      refreshHourlyRate,
      updateHourlyRate,
      createSessionOption,
      updateSessionOption,
      deleteSessionOption,
      updateBookingFee,
      loadMoreReservations,
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
      createReservation,
      updateReservation,
      deleteReservation,
      createReservationAsset,
      toggleReservationAssetVisibility,
      updateSchedule,
      createClosure,
      updateClosure,
      deleteClosure
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
