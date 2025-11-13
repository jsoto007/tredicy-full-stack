import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FadeIn from '../components/FadeIn.jsx';
import Button from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import { BOOKING_REQUIREMENTS } from '../data/bookingRequirements.js';
import { apiGet, apiPost } from '../lib/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';

const SLOT_INTERVAL_MINUTES = 60;
const JS_DAY_SLUGS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const DAY_FORMATTER = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const TIME_FORMATTER = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const MAX_MONTH_HORIZON = 5;

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/heic', 'image/heif', 'image/webp']);
const ACCEPTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.heic', '.heif', '.webp'];

const PLACEMENT_BASE_MINUTES = {
  finger: 60,
  wrist: 60,
  ankle: 75,
  forearm: 90,
  upper_arm: 120,
  shoulder: 120,
  hand: 120,
  calf: 120,
  thigh: 150,
  rib: 150,
  chest: 180,
  back: 240,
  neck: 150,
  full_sleeve: 300,
  other: 120
};

const SIZE_MULTIPLIERS = {
  small: 1,
  medium: 1.5,
  large: 2,
  xl: 3
};

const PLACEMENT_OPTIONS = [
  { value: 'finger', label: 'Finger or knuckles' },
  { value: 'wrist', label: 'Wrist' },
  { value: 'forearm', label: 'Forearm' },
  { value: 'upper_arm', label: 'Upper arm' },
  { value: 'shoulder', label: 'Shoulder' },
  { value: 'full_sleeve', label: 'Full sleeve' },
  { value: 'hand', label: 'Hand' },
  { value: 'ankle', label: 'Ankle' },
  { value: 'calf', label: 'Calf' },
  { value: 'thigh', label: 'Thigh' },
  { value: 'rib', label: 'Ribs / side' },
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'neck', label: 'Neck' },
  { value: 'other', label: 'Other (describe below)' }
];

const SIZE_OPTIONS = [
  { value: 'small', label: 'Small (1-3 inches)' },
  { value: 'medium', label: 'Medium (4-6 inches)' },
  { value: 'large', label: 'Large (7-10 inches)' },
  { value: 'xl', label: 'Extended (11"+ or more)' }
];

const BOOKING_RECEIPT_KEY = 'black-ink:last-booking';

const FIELD_LABELS = {
  first_name: 'your first name',
  last_name: 'your last name',
  email: 'contact email',
  selected_date: 'date selection',
  tattoo_placement: 'placement selection',
  tattoo_size: 'size selection',
  description: 'inspiration details',
  id_front: 'government ID',
  id_back: 'government ID',
  scheduled_start: 'date & time',
  password: 'account password',
  files: 'upload section'
};

const VALIDATION_ORDER = [
  'first_name',
  'last_name',
  'email',
  'tattoo_placement',
  'tattoo_size',
  'selected_date',
  'description',
  'id_front',
  'id_back',
  'scheduled_start',
  'password'
];

function createInitialForm() {
  return {
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    create_account: false,
    password: '',
    description: '',
    placement: '',
    size: '',
    placement_notes: ''
  };
}

function createInitialFiles() {
  return {
    idFront: null,
    idBack: null,
    inspiration: []
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read file.'));
    reader.readAsDataURL(file);
  });
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(date, offset) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function parseDateKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function buildCalendarDays(monthDate) {
  const first = startOfMonth(monthDate);
  const days = [];
  const leading = first.getDay();

  for (let index = 0; index < leading; index += 1) {
    const date = new Date(first);
    date.setDate(first.getDate() - (leading - index));
    days.push({ date, inCurrentMonth: false });
  }

  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push({
      date: new Date(first.getFullYear(), first.getMonth(), day),
      inCurrentMonth: true
    });
  }

  while (days.length % 7 !== 0) {
    const last = days[days.length - 1].date;
    const next = new Date(last);
    next.setDate(last.getDate() + 1);
    days.push({ date: next, inCurrentMonth: false });
  }

  return days;
}

function calculateSuggestedDurationMinutes(
  placement,
  size,
  minimum = SLOT_INTERVAL_MINUTES,
  interval = SLOT_INTERVAL_MINUTES
) {
  const base = PLACEMENT_BASE_MINUTES[placement] ?? 120;
  const multiplier = SIZE_MULTIPLIERS[size] ?? 1;
  const raw = base * multiplier;
  const blocks = Math.max(1, Math.ceil(raw / interval));
  const minutes = blocks * interval;
  return minutes < minimum ? minimum : minutes;
}

function formatDurationLabel(minutes) {
  const hours = minutes / 60;
  return hours === 1 ? '1 hour' : `${hours} hours`;
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) {
    return '';
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

function storeBookingReceipt(appointment) {
  try {
    sessionStorage.setItem(BOOKING_RECEIPT_KEY, JSON.stringify({ appointment, savedAt: Date.now() }));
  } catch {
    // Ignore persistence failures (e.g. Safari private mode).
  }
}

const WALLET_METHODS = [
  {
    id: 'applePay',
    label: 'Apple Pay',
    factory: (payments) => payments.applePay?.()
  },
  {
    id: 'googlePay',
    label: 'Google Pay',
    factory: (payments) => payments.googlePay?.()
  }
];

function validateFile(file) {
  if (!file) {
    return 'File missing.';
  }
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  const hasValidType = ACCEPTED_MIME_TYPES.has(type);
  const hasValidExtension = ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension));
  if (!hasValidType && !hasValidExtension) {
    return 'Only PNG, JPG, HEIC, or WebP files are accepted.';
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `Files must be under ${Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))} MB.`;
  }
  return null;
}

export default function ShareYourIdea() {
  const today = useMemo(() => startOfDay(new Date()), []);
  const minMonth = useMemo(() => startOfMonth(today), [today]);
  const maxMonth = useMemo(() => shiftMonth(minMonth, MAX_MONTH_HORIZON), [minMonth]);

  const navigate = useNavigate();
  const { isAuthenticated, account } = useAuth();

  const [form, setForm] = useState(() => createInitialForm());
  const [files, setFiles] = useState(() => createInitialFiles());
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [noticeTone, setNoticeTone] = useState('success');
  const [submitting, setSubmitting] = useState(false);

  const [availabilityConfig, setAvailabilityConfig] = useState(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState(null);

  const [calendarMonth, setCalendarMonth] = useState(() => minMonth);
  const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsMeta, setSlotsMeta] = useState({ isClosed: false, fullyBooked: false, workingWindow: null });
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [suggestedMinutes, setSuggestedMinutes] = useState(SLOT_INTERVAL_MINUTES);
  const [durationMinutes, setDurationMinutes] = useState(SLOT_INTERVAL_MINUTES);
  const [durationManuallySet, setDurationManuallySet] = useState(false);
  const [forceIdentityUpdate, setForceIdentityUpdate] = useState(false);
  const [pricingEstimate, setPricingEstimate] = useState(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState(null);

  const [paymentConfig, setPaymentConfig] = useState(null);
  const [paymentConfigLoaded, setPaymentConfigLoaded] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('idle');
  const [paymentError, setPaymentError] = useState(null);
  const paymentsRef = useRef(null);
  const cardInstanceRef = useRef(null);
  const cardContainerRef = useRef(null);
  const walletInstancesRef = useRef({});
  const pricingCacheRef = useRef({});
  const [availableWallets, setAvailableWallets] = useState([]);
  const [walletProcessing, setWalletProcessing] = useState(null);
  const firstNameRef = useRef(null);
  const lastNameRef = useRef(null);
  const emailRef = useRef(null);
  const placementRef = useRef(null);
  const sizeRef = useRef(null);
  const descriptionRef = useRef(null);
  const inspirationRef = useRef(null);
  const identityRef = useRef(null);
  const scheduleRef = useRef(null);
  const passwordRef = useRef(null);

  const minimumDuration = availabilityConfig?.minimumDurationMinutes ?? SLOT_INTERVAL_MINUTES;

  const requirementList = useMemo(
    () =>
      BOOKING_REQUIREMENTS.map((item, index) => (
        <li key={index} className="text-xs uppercase tracking-[0.25em] text-gray-500 dark:text-gray-400">
          {item}
        </li>
      )),
    []
  );

  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);

  const durationOptions = useMemo(() => {
    const options = new Set();
    const interval = availabilityConfig?.slotIntervalMinutes ?? SLOT_INTERVAL_MINUTES;
    const upperBound = interval * 6; // show up to ~6 blocks by default
    for (let minutes = minimumDuration; minutes <= upperBound; minutes += interval) {
      options.add(minutes);
    }
    options.add(suggestedMinutes); // ensure the recommended value is always present
    return Array.from(options).sort((a, b) => a - b);
  }, [minimumDuration, suggestedMinutes, availabilityConfig?.slotIntervalMinutes]);

  const formattedSelectedDate = selectedDate ? DAY_FORMATTER.format(parseDateKey(selectedDate)) : '';
  const canGoPrev = calendarMonth.getTime() > minMonth.getTime();
  const canGoNext = calendarMonth.getTime() < maxMonth.getTime();
  const hasStoredIdentity = Boolean(isAuthenticated && account?.has_identity_documents);
  const shouldSkipIdentityUpload = hasStoredIdentity && !forceIdentityUpdate;
  const signedInAccountId = isAuthenticated && account?.id ? account.id : null;

  const depositAmountCents = paymentConfig?.deposit_amount_cents ?? 0;
  const depositCurrency = paymentConfig?.currency ?? 'USD';
  const depositAmountLabel = useMemo(() => {
    if (!depositAmountCents) {
      return null;
    }
    const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: depositCurrency });
    return formatter.format(depositAmountCents / 100);
  }, [depositAmountCents, depositCurrency]);

  const pricingCurrency = pricingEstimate?.currency ?? 'USD';
  const pricingFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: pricingCurrency
      }),
    [pricingCurrency]
  );
  const estimatedTotalLabel =
    pricingEstimate?.total_cents != null ? pricingFormatter.format(pricingEstimate.total_cents / 100) : null;
  const serverHourlyRateLabel =
    pricingEstimate?.hourly_rate_cents != null ? pricingFormatter.format(pricingEstimate.hourly_rate_cents / 100) : null;
  const paymentsUnavailable = paymentConfigLoaded && !paymentConfig?.enabled && !paymentConfig?.demo_mode;
  const submitDisabled =
    submitting || (paymentConfig?.enabled ? paymentStatus !== 'ready' : false) || paymentsUnavailable;
  const submitLabel = submitting
    ? 'Processing...'
    : paymentConfig?.enabled
    ? `Pay ${depositAmountLabel || 'deposit'} & book`
    : 'Submit booking';

  const loadAvailabilityConfig = useCallback(async () => {
    if (availabilityConfig || availabilityLoading) {
      return;
    }
    setAvailabilityLoading(true);
    try {
      const data = await apiGet('/api/availability/config');
      const closures = new Set(data?.closures || []);
      const operatingHours = Array.isArray(data?.operating_hours) ? data.operating_hours : [];
      const operatingHoursMap = new Map();
      operatingHours.forEach((entry) => {
        if (entry?.day) {
          operatingHoursMap.set(entry.day, entry);
        }
      });
      setAvailabilityConfig({
        operatingHours,
        operatingHoursMap,
        closures,
        slotIntervalMinutes: data?.slot_interval_minutes || SLOT_INTERVAL_MINUTES,
        minimumDurationMinutes: data?.minimum_duration_minutes || SLOT_INTERVAL_MINUTES
      });
      setAvailabilityError(null);
    } catch (error) {
      setAvailabilityError('Unable to load studio availability right now.');
    } finally {
      setAvailabilityLoading(false);
    }
  }, [availabilityConfig, availabilityLoading]);

  const fetchSlots = useCallback(
    async (dateIso, minutes) => {
      if (!dateIso) {
        return;
      }
      setSlotsLoading(true);
      try {
        const params = new URLSearchParams({
          date: dateIso,
          duration_minutes: String(minutes)
        });
        const data = await apiGet(`/api/availability?${params.toString()}`);
        const slots = Array.isArray(data?.slots) ? data.slots : [];
        setAvailableSlots(slots);
        setSlotsMeta({
          isClosed: Boolean(data?.is_closed),
          fullyBooked: Boolean(data?.fully_booked),
          workingWindow: data?.working_window || null
        });
        setSlotsError(null);
        setSelectedSlot((previous) => {
          if (!previous) {
            return null;
          }
          return slots.find((slot) => slot.start === previous.start) || null;
        });
      } catch (error) {
        setAvailableSlots([]);
        setSlotsMeta({ isClosed: false, fullyBooked: false, workingWindow: null });
        setSlotsError('Unable to load available time slots.');
      } finally {
        setSlotsLoading(false);
      }
    },
    [form.placement, form.size]
  );

  const resetBookingState = useCallback(() => {
    const baseDuration = availabilityConfig?.minimumDurationMinutes ?? SLOT_INTERVAL_MINUTES;
    setFiles((prev) => {
      if (prev.idFront?.previewUrl) {
        URL.revokeObjectURL(prev.idFront.previewUrl);
      }
      if (prev.idBack?.previewUrl) {
        URL.revokeObjectURL(prev.idBack.previewUrl);
      }
      prev.inspiration.forEach((entry) => entry.previewUrl && URL.revokeObjectURL(entry.previewUrl));
      return createInitialFiles();
    });
    setForm(createInitialForm());
    setErrors({});
    setSelectedDate('');
    setSelectedSlot(null);
    setAvailableSlots([]);
    setSlotsMeta({ isClosed: false, fullyBooked: false, workingWindow: null });
    setSlotsError(null);
    setSlotsLoading(false);
    setDurationManuallySet(false);
    setDurationMinutes(baseDuration);
    setSuggestedMinutes(baseDuration);
    setCalendarMonth(minMonth);
    setForceIdentityUpdate(false);
  }, [availabilityConfig, minMonth]);

  useEffect(() => {
    loadAvailabilityConfig();
  }, [loadAvailabilityConfig]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const config = await apiGet('/api/payments/config');
        if (!isMounted) {
          return;
        }
        setPaymentConfig(config?.square || null);
        setPaymentError(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setPaymentConfig(null);
        setPaymentError('Unable to load payment settings right now.');
      } finally {
        if (isMounted) {
          setPaymentConfigLoaded(true);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!paymentConfig?.enabled) {
      setPaymentStatus(paymentConfig?.demo_mode ? 'ready' : 'idle');
      if (cardInstanceRef.current?.destroy) {
        cardInstanceRef.current.destroy();
      }
      cardInstanceRef.current = null;
      paymentsRef.current = null;
      walletInstancesRef.current = {};
      setAvailableWallets([]);
      setWalletProcessing(null);
      return;
    }
    setPaymentStatus('loading');
    walletInstancesRef.current = {};
    setAvailableWallets([]);
    setWalletProcessing(null);
    let cancelled = false;
    const sdkUrl =
      paymentConfig.environment === 'production'
        ? 'https://web.squarecdn.com/v1/square.js'
        : 'https://sandbox.web.squarecdn.com/v1/square.js';

    const loadSdk = () =>
      new Promise((resolve, reject) => {
        if (window.Square) {
          resolve();
          return;
        }
        let script = document.querySelector('script[data-square-sdk]');
        if (!script) {
          script = document.createElement('script');
          script.src = sdkUrl;
          script.async = true;
          script.dataset.squareSdk = 'true';
          document.head.appendChild(script);
        } else if (script.dataset.loaded === 'true') {
          resolve();
          return;
        }

        const handleLoad = () => {
          script.dataset.loaded = 'true';
          resolve();
        };
        const handleError = () => reject(new Error('Unable to load payment SDK.'));

        script.addEventListener('load', handleLoad, { once: true });
        script.addEventListener('error', handleError, { once: true });
      });

    (async () => {
      try {
        await loadSdk();
        if (!window.Square) {
          throw new Error('Square SDK unavailable.');
        }
        if (!cardContainerRef.current) {
          throw new Error('Payment form is unavailable. Refresh to try again.');
        }
        const payments = window.Square.payments(paymentConfig.application_id, paymentConfig.location_id);
        const card = await payments.card();
        await card.attach(cardContainerRef.current);
        if (cancelled) {
          card.destroy();
          return;
        }
        paymentsRef.current = payments;
        cardInstanceRef.current = card;
        const walletCandidates = [];
        for (const method of WALLET_METHODS) {
          let walletInstance;
          try {
            walletInstance = await method.factory(payments);
            if (!walletInstance) {
              continue;
            }
            const availability = await walletInstance.canMakePayment?.();
            const canUse =
              typeof availability === 'boolean'
                ? availability
                : Boolean(availability?.canMakePayment ?? availability?.supported ?? availability);
            if (canUse) {
              walletInstancesRef.current[method.id] = walletInstance;
              walletCandidates.push({ id: method.id, label: method.label });
            } else {
              walletInstance.destroy?.();
            }
          } catch {
            walletInstance?.destroy?.();
          }
        }
        if (!cancelled) {
          setAvailableWallets(walletCandidates);
        } else {
          walletCandidates.forEach((wallet) => walletInstancesRef.current[wallet.id]?.destroy?.());
        }
        setPaymentStatus('ready');
        setPaymentError(null);
      } catch (error) {
        if (!cancelled) {
          setPaymentStatus('error');
          setPaymentError(error.message || 'Unable to load payment form.');
        }
      }
    })();

    return () => {
      cancelled = true;
      if (cardInstanceRef.current?.destroy) {
        cardInstanceRef.current.destroy();
      }
      cardInstanceRef.current = null;
      paymentsRef.current = null;
      Object.values(walletInstancesRef.current).forEach((wallet) => wallet?.destroy?.());
      walletInstancesRef.current = {};
      setAvailableWallets([]);
      setWalletProcessing(null);
    };
  }, [paymentConfig]);

  useEffect(() => {
    return () => {
      if (files.idFront?.previewUrl) {
        URL.revokeObjectURL(files.idFront.previewUrl);
      }
      if (files.idBack?.previewUrl) {
        URL.revokeObjectURL(files.idBack.previewUrl);
      }
      files.inspiration.forEach((entry) => entry.previewUrl && URL.revokeObjectURL(entry.previewUrl));
    };
  }, [files]);

  useEffect(() => {
    if (!availabilityConfig) {
      return;
    }
    const interval = availabilityConfig.slotIntervalMinutes ?? SLOT_INTERVAL_MINUTES;

    if (!form.placement || !form.size) {
      const base = availabilityConfig.minimumDurationMinutes;
      setSuggestedMinutes(base);
      if (!durationManuallySet) {
        setDurationMinutes(base);
      }
      return;
    }

    const suggested = calculateSuggestedDurationMinutes(
      form.placement,
      form.size,
      availabilityConfig.minimumDurationMinutes,
      interval
    );
    setSuggestedMinutes(suggested);
    if (!durationManuallySet) {
      setDurationMinutes(suggested);
    }
  }, [availabilityConfig, form.placement, form.size, durationManuallySet]);

  useEffect(() => {
    if (!availabilityConfig) {
      return;
    }
    if (!selectedDate) {
      setAvailableSlots([]);
      setSlotsMeta({ isClosed: false, fullyBooked: false, workingWindow: null });
      return;
    }
    fetchSlots(selectedDate, durationMinutes);
  }, [availabilityConfig, selectedDate, durationMinutes, fetchSlots]);

  useEffect(() => {
    setSelectedSlot(null);
  }, [durationMinutes]);

  useEffect(() => {
    if (!durationMinutes) {
      setPricingEstimate(null);
      setPricingError(null);
      setPricingLoading(false);
      return;
    }
    const cached = pricingCacheRef.current[durationMinutes];
    if (cached) {
      setPricingEstimate(cached);
      setPricingError(null);
      return;
    }
    const controller = new AbortController();
    setPricingLoading(true);
    setPricingError(null);
    apiGet(`/api/pricing/estimate?duration_minutes=${durationMinutes}`, { signal: controller.signal })
      .then((result) => {
        pricingCacheRef.current[durationMinutes] = result;
        setPricingEstimate(result);
      })
      .catch((error) => {
        if (error.name === 'AbortError') {
          return;
        }
        setPricingEstimate(null);
        setPricingError('Unable to load pricing.');
      })
      .finally(() => {
        setPricingLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [durationMinutes]);

  useEffect(() => {
    if (!isAuthenticated || !account) {
      return;
    }
    setForm((prev) => ({
      ...prev,
      first_name: prev.first_name || account.first_name || '',
      last_name: prev.last_name || account.last_name || '',
      email: account.email || prev.email,
      phone: account.phone || prev.phone,
      create_account: false,
      password: ''
    }));
  }, [isAuthenticated, account]);

  useEffect(() => {
    if (!hasStoredIdentity) {
      setForceIdentityUpdate(false);
    }
  }, [hasStoredIdentity]);

  useEffect(() => {
    if (!shouldSkipIdentityUpload) {
      return;
    }
    setFiles((prev) => ({
      ...prev,
      idFront: null,
      idBack: null
    }));
    setErrors((prev) => {
      if (!prev.id_front && !prev.id_back) {
        return prev;
      }
      const next = { ...prev };
      delete next.id_front;
      delete next.id_back;
      return next;
    });
  }, [shouldSkipIdentityUpload]);

  const isDateBookable = useCallback(
    (date) => {
      if (!availabilityConfig) {
        return false;
      }
      if (date.getTime() < today.getTime()) {
        return false;
      }
      const dayKey = formatDateKey(date);
      if (availabilityConfig.closures.has(dayKey)) {
        return false;
      }
      const dayConfig = availabilityConfig.operatingHoursMap.get(JS_DAY_SLUGS[date.getDay()]);
      return Boolean(dayConfig?.is_open);
    },
    [availabilityConfig, today]
  );

  const handleChange = (field) => (event) => {
    if (field === 'create_account') {
      const checked = event.target.checked;
      setForm((prev) => ({
        ...prev,
        create_account: checked,
        password: checked ? prev.password : ''
      }));
      setErrors((prev) => {
        if (!prev.password && !prev.create_account) {
          return prev;
        }
        const next = { ...prev };
        delete next.create_account;
        delete next.password;
        return next;
      });
      return;
    }

    const value = event.target.value;
    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
    setErrors((prev) => {
      if (!prev[field]) {
        return prev;
      }
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleDescriptionChange = (event) => {
    const value = event.target.value;
    setForm((prev) => ({
      ...prev,
      description: value
    }));
    setErrors((prev) => {
      if (!prev.description) {
        return prev;
      }
      const next = { ...prev };
      delete next.description;
      return next;
    });
  };

  const handlePlacementChange = (value) => {
    setForm((prev) => ({
      ...prev,
      placement: value
    }));
    setErrors((prev) => {
      if (!prev.tattoo_placement) {
        return prev;
      }
      const next = { ...prev };
      delete next.tattoo_placement;
      return next;
    });
  };

  const handleSizeChange = (value) => {
    setForm((prev) => ({
      ...prev,
      size: value
    }));
    setErrors((prev) => {
      if (!prev.tattoo_size) {
        return prev;
      }
      const next = { ...prev };
      delete next.tattoo_size;
      return next;
    });
  };

  const handleFileChange = (field) => (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) {
      setFiles((prev) => {
        const next = { ...prev };
        if (field === 'inspiration') {
          prev.inspiration.forEach((entry) => entry.previewUrl && URL.revokeObjectURL(entry.previewUrl));
          next.inspiration = [];
        } else if (prev[field]?.previewUrl) {
          URL.revokeObjectURL(prev[field].previewUrl);
          next[field] = null;
        }
        return next;
      });
      event.target.value = '';
      return;
    }

    const errorsForSelection = [];

    if (field === 'inspiration') {
      setFiles((prev) => {
        prev.inspiration.forEach((entry) => entry.previewUrl && URL.revokeObjectURL(entry.previewUrl));
        const uploads = [];
        for (const file of selectedFiles.slice(0, 3)) {
          const validationError = validateFile(file);
          if (validationError) {
            errorsForSelection.push(`${file.name}: ${validationError}`);
            continue;
          }
          const previewUrl = URL.createObjectURL(file);
          uploads.push({
            file,
            previewUrl,
            name: file.name,
            size: file.size,
            type: file.type
          });
        }
        setErrors((prevErrors) => {
          const nextErrors = { ...prevErrors };
          if (uploads.length) {
            delete nextErrors.description;
          }
          if (errorsForSelection.length) {
            nextErrors.files = errorsForSelection.join(' ');
          } else {
            delete nextErrors.files;
          }
          return nextErrors;
        });
        return {
          ...prev,
          inspiration: uploads
        };
      });
    } else {
      const file = selectedFiles[0];
      const validationError = validateFile(file);
      if (validationError) {
        setErrors((prev) => ({
          ...prev,
          files: `${file.name}: ${validationError}`
        }));
        event.target.value = '';
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      setFiles((prev) => {
        if (prev[field]?.previewUrl) {
          URL.revokeObjectURL(prev[field].previewUrl);
        }
        return {
          ...prev,
          [field]: {
            file,
            previewUrl,
            name: file.name,
            size: file.size,
            type: file.type
          }
        };
      });
      setErrors((prev) => {
        const next = { ...prev };
        if (field === 'idFront') {
          delete next.id_front;
        } else if (field === 'idBack') {
          delete next.id_back;
        }
        delete next.files;
        return next;
      });
    }

    event.target.value = '';
  };

  const handleSelectDate = (day) => {
    if (!isDateBookable(day)) {
      return;
    }
    const key = formatDateKey(day);
    setSelectedDate(key);
    setSelectedSlot(null);
    setErrors((prev) => {
      if (!prev.scheduled_start) {
        return prev;
      }
      const next = { ...prev };
      delete next.scheduled_start;
      return next;
    });
  };

  const handleSlotSelect = (slot) => {
    setSelectedSlot(slot);
    setErrors((prev) => {
      if (!prev.scheduled_start) {
        return prev;
      }
      const next = { ...prev };
      delete next.scheduled_start;
      return next;
    });
  };

  const handleDurationSelect = (minutes) => {
    setDurationMinutes(minutes);
    setDurationManuallySet(true);
  };

  const scrollToField = useCallback(
    (fieldKey) => {
      const targetMap = {
        first_name: firstNameRef,
        last_name: lastNameRef,
        email: emailRef,
        selected_date: scheduleRef,
        tattoo_placement: placementRef,
        tattoo_size: sizeRef,
        description: descriptionRef,
        files: inspirationRef,
        id_front: identityRef,
        id_back: identityRef,
        scheduled_start: scheduleRef,
        password: passwordRef
      };
      const targetRef = targetMap[fieldKey];
      const node = targetRef?.current;
      if (!node) {
        return;
      }
      if (typeof node.scrollIntoView === 'function') {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      const focusableSelector = 'input, textarea, select, button, [tabindex]';
      const focusTarget =
        typeof node.matches === 'function' && node.matches(focusableSelector)
          ? node
          : node.querySelector?.(focusableSelector);
      if (focusTarget && typeof focusTarget.focus === 'function') {
        try {
          focusTarget.focus({ preventScroll: true });
        } catch {
          focusTarget.focus();
        }
      }
    },
    [
      descriptionRef,
      emailRef,
      identityRef,
      inspirationRef,
      passwordRef,
      placementRef,
      scheduleRef,
      sizeRef,
      firstNameRef,
      lastNameRef
    ]
  );

  const validate = useCallback(() => {
    const validationErrors = {};
    if (!form.first_name.trim()) {
      validationErrors.first_name = 'Required';
    }
    if (!form.last_name.trim()) {
      validationErrors.last_name = 'Required';
    }
    if (!form.email.trim()) {
      validationErrors.email = 'Required';
    }
    if (!shouldSkipIdentityUpload) {
      if (!files.idFront?.file) {
        validationErrors.id_front = 'Required';
      }
      if (!files.idBack?.file) {
        validationErrors.id_back = 'Required';
      }
    }
    if (!form.description.trim() && !files.inspiration.length) {
      validationErrors.description = 'Add inspiration details';
    }
    if (!selectedDate) {
      validationErrors.selected_date = 'Select a date';
    }
    if (!form.placement) {
      validationErrors.tattoo_placement = 'Select placement';
    }
    if (!form.size) {
      validationErrors.tattoo_size = 'Select approximate size';
    }
    if (!selectedSlot) {
      validationErrors.scheduled_start = 'Choose a time slot';
    }
    if (form.create_account && form.password.trim().length < 8) {
      validationErrors.password = 'Min. 8 characters';
    }
    setErrors(validationErrors);
    const hasErrors = Object.keys(validationErrors).length > 0;
    if (hasErrors) {
      const firstErrorKey = VALIDATION_ORDER.find((key) => validationErrors[key]);
      if (firstErrorKey) {
        const label = FIELD_LABELS[firstErrorKey] || 'required section';
        setNotice(`Looks like ${label} still needs info. Please update it to continue.`);
        setNoticeTone('offline');
        scrollToField(firstErrorKey);
      } else {
        setNotice('Please review the highlighted fields before submitting.');
        setNoticeTone('offline');
      }
      return false;
    }
    setNotice(null);
    return true;
  }, [form, files, selectedSlot, shouldSkipIdentityUpload, scrollToField, setNotice, setNoticeTone]);

  const handleFileReadError = useCallback(() => {
    setNotice('Unable to read the selected files. Please try again.');
    setNoticeTone('offline');
  }, [setNotice, setNoticeTone]);

  const prepareBookingPayload = useCallback(async () => {
    const contactName = `${form.first_name.trim()} ${form.last_name.trim()}`.replace(/\s+/g, ' ').trim();
    const [idFrontDataUrl, idBackDataUrl, inspirationDataUrls] = await Promise.all([
      shouldSkipIdentityUpload ? Promise.resolve(null) : files.idFront?.file ? readFileAsDataUrl(files.idFront.file) : Promise.resolve(null),
      shouldSkipIdentityUpload ? Promise.resolve(null) : files.idBack?.file ? readFileAsDataUrl(files.idBack.file) : Promise.resolve(null),
      Promise.all(files.inspiration.map((entry) => readFileAsDataUrl(entry.file)))
    ]);
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim() || null,
      contact_name: contactName || null,
      create_account: form.create_account,
      description: form.description.trim(),
      tattoo_placement: form.placement,
      tattoo_size: form.size,
      placement_notes: form.placement_notes.trim() || null,
      scheduled_start: selectedSlot?.start,
      duration_minutes: durationMinutes,
      id_front_url: shouldSkipIdentityUpload ? null : idFrontDataUrl,
      id_back_url: shouldSkipIdentityUpload ? null : idBackDataUrl,
      inspiration_urls: inspirationDataUrls.filter(Boolean)
    };
    if (form.create_account) {
      payload.password = form.password;
    }
    if (signedInAccountId) {
      payload.client_account_id = signedInAccountId;
    }
    if (shouldSkipIdentityUpload) {
      payload.reuse_identity_on_file = true;
    }
    return payload;
  }, [
    form,
    files,
    selectedSlot,
    durationMinutes,
    shouldSkipIdentityUpload,
    signedInAccountId
  ]);

  const buildSquareFieldsFromToken = useCallback((tokenResult) => {
    if (!tokenResult?.token) {
      throw new Error('Unable to verify the payment method.');
    }
    const fields = {
      square_source_id: tokenResult.token,
      square_idempotency_key:
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`
    };
    const verificationToken = tokenResult.details?.verificationToken ?? tokenResult.verificationToken;
    if (verificationToken) {
      fields.square_verification_token = verificationToken;
    }
    return fields;
  }, []);

  const completeBooking = useCallback(
    async (payload) => {
      const response = await apiPost('/api/appointments', payload);
      storeBookingReceipt(response);
      setNotice(null);
      resetBookingState();
      navigate('/booking/confirmation');
    },
    [navigate, resetBookingState]
  );

  const getBookingErrorMessage = useCallback((error) => {
    if (error?.body?.error) {
      return error.body.error;
    }
    if (error?.status === 402) {
      return 'Payment failed. Please try another payment method.';
    }
    return 'Unable to complete your booking right now. Please try again.';
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) {
      return;
    }

    setSubmitting(true);
    let payload;
    try {
      payload = await prepareBookingPayload();
    } catch (error) {
      handleFileReadError();
      setSubmitting(false);
      return;
    }

    const squareFields = {};
    if (paymentConfig?.enabled) {
      setPaymentError(null);
      try {
        if (!cardInstanceRef.current) {
          throw new Error('Payment form is still loading. Please wait a moment.');
        }
        const tokenResult = await cardInstanceRef.current.tokenize();
        if (tokenResult.status !== 'OK') {
          throw new Error(tokenResult.errors?.[0]?.message || 'Unable to verify your card.');
        }
        Object.assign(squareFields, buildSquareFieldsFromToken(tokenResult));
      } catch (error) {
        setPaymentError(error.message || 'Unable to verify your card. Please try again.');
        setSubmitting(false);
        return;
      }
    }

    Object.assign(payload, squareFields);

    try {
      await completeBooking(payload);
    } catch (error) {
      const message = getBookingErrorMessage(error);
      setPaymentError(message);
      const noticeMessage =
        error?.status === 402 ? 'Payment failed. Please try another method.' : 'Request saved locally. We will follow up once connected.';
      setNotice(noticeMessage);
      setNoticeTone(error?.status === 402 ? 'error' : 'offline');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWalletPayment = useCallback(
    async (walletId) => {
      if (!validate()) {
        return;
      }
      const walletInstance = walletInstancesRef.current[walletId];
      if (!walletInstance) {
        setPaymentError('This payment method is unavailable right now.');
        return;
      }

      setSubmitting(true);
      setPaymentError(null);
      setWalletProcessing(walletId);

      let payload;
      try {
        payload = await prepareBookingPayload();
      } catch (error) {
        handleFileReadError();
        setWalletProcessing(null);
        setSubmitting(false);
        return;
      }

      try {
        const tokenResult = await walletInstance.tokenize();
        if (tokenResult.status !== 'OK') {
          throw new Error(tokenResult.errors?.[0]?.message || 'Unable to verify your payment.');
        }
        Object.assign(payload, buildSquareFieldsFromToken(tokenResult));
        await completeBooking(payload);
      } catch (error) {
        if (error?.status) {
          const message = getBookingErrorMessage(error);
          setPaymentError(message);
          const noticeMessage =
            error.status === 402 ? 'Payment failed. Please try another method.' : 'Request saved locally. We will follow up once connected.';
          setNotice(noticeMessage);
          setNoticeTone(error.status === 402 ? 'error' : 'offline');
        } else {
          setPaymentError(error.message || 'Unable to verify your payment. Please try again.');
        }
      } finally {
        setWalletProcessing(null);
        setSubmitting(false);
      }
    },
    [
      validate,
      prepareBookingPayload,
      handleFileReadError,
      buildSquareFieldsFromToken,
      completeBooking,
      getBookingErrorMessage
    ]
  );

  const renderCalendarDay = (entry) => {
    const { date, inCurrentMonth } = entry;
    const dateKey = formatDateKey(date);
    const isToday = date.getTime() === today.getTime();
    const isSelected = selectedDate === dateKey;
    const selectable = isDateBookable(date);
    const disabled = !inCurrentMonth || !selectable || availabilityLoading;

    return (
      <button
        key={dateKey}
        type="button"
        onClick={() => handleSelectDate(date)}
        disabled={disabled}
        className={classNames(
          'flex h-11 items-center justify-center rounded-xl border text-sm font-medium transition',
          disabled
            ? 'cursor-not-allowed border-transparent text-gray-400 opacity-50 dark:text-gray-600'
            : isSelected
            ? 'border-gray-900 bg-gray-900 text-white shadow-sm dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900'
            : isToday
            ? 'border-gray-900 text-gray-900 dark:border-gray-100 dark:text-gray-100'
            : 'border-transparent text-gray-700 hover:border-gray-900 hover:text-gray-900 dark:text-gray-300 dark:hover:border-gray-400 dark:hover:text-gray-100'
        )}
      >
        {date.getDate()}
      </button>
    );
  };

  return (
    <main className="bg-white py-10 text-gray-900 dark:bg-black dark:text-gray-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4">
        <FadeIn className="flex flex-col gap-6" delayStep={0.1}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <SectionTitle
              eyebrow="Booking"
              title="Share your idea"
              description="Submit your concept, secure ID verification, and lock in time that matches your availability."
            />
            <Button as={Link} to="/" variant="secondary">
              Back to home
            </Button>
          </div>
        </FadeIn>

        <FadeIn immediate>
          {isAuthenticated ? (
            <Card className="flex flex-col gap-2 text-sm text-gray-600 dark:text-gray-300">
              <p>
                Signed in as <span className="font-semibold">{account?.email}</span>. We pre-fill your profile details for
                faster booking.
              </p>
              {hasStoredIdentity ? (
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                  Government ID is already on file. You can update it below if needed.
                </p>
              ) : null}
            </Card>
          ) : (
            <Card className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600 dark:text-gray-300">
              <p>Already have an account? Sign in for a faster booking experience and skip re-entering your details.</p>
              <Button as={Link} to="/auth" variant="secondary">
                Sign in
              </Button>
            </Card>
          )}
        </FadeIn>

        {notice ? (
          <FadeIn
            immediate
            className={`rounded-2xl border px-6 py-4 text-xs uppercase tracking-[0.3em] ${
              noticeTone === 'success'
                ? 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300'
                : 'border-gray-300 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200'
            }`}
          >
            {notice}
          </FadeIn>
        ) : null}

        <FadeIn as="form" className="space-y-6" onSubmit={handleSubmit} immediate delayStep={0.08} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="booking-first-name"
                className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
              >
                First name *
              </label>
              <input
                id="booking-first-name"
                name="first_name"
                type="text"
                value={form.first_name}
                onChange={handleChange('first_name')}
                autoComplete="given-name"
                ref={firstNameRef}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
                required
              />
              {errors.first_name ? (
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                  {errors.first_name}
                </p>
              ) : null}
            </div>
            <div>
              <label
                htmlFor="booking-last-name"
                className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
              >
                Last name *
              </label>
              <input
                id="booking-last-name"
                name="last_name"
                type="text"
                value={form.last_name}
                onChange={handleChange('last_name')}
                autoComplete="family-name"
                ref={lastNameRef}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
                required
              />
              {errors.last_name ? (
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                  {errors.last_name}
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="booking-email"
                className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
              >
                Email *
              </label>
              <input
                id="booking-email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange('email')}
                autoComplete="email"
                ref={emailRef}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
                required
              />
              {errors.email ? (
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">{errors.email}</p>
              ) : null}
            </div>
            <div>
              <label
                htmlFor="booking-phone"
                className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
              >
                Phone (optional)
              </label>
              <input
                id="booking-phone"
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange('phone')}
                autoComplete="tel"
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
              />
              {errors.phone ? (
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">{errors.phone}</p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div ref={placementRef}>
              <label
                htmlFor="booking-placement"
                className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
              >
                Placement *
              </label>
              <Menu as="div" className="relative mt-2 w-full">
                <MenuButton
                  id="booking-placement"
                  className="flex w-full items-center justify-between gap-x-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-left text-lg sm:text-base font-medium text-gray-900 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:shadow-none dark:hover:bg-white/5 dark:focus:border-gray-500 dark:focus:ring-gray-700/40 sm:text-base"
                >
                  <span>{PLACEMENT_OPTIONS.find((option) => option.value === form.placement)?.label ?? 'Select placement'}</span>
                  <ChevronDownIcon aria-hidden="true" className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                </MenuButton>
                <MenuItems
                  transition
                  className="absolute z-10 mt-2 w-full origin-top rounded-xl border border-gray-200 bg-white py-2 shadow-lg ring-1 ring-black/5 focus:outline-none max-h-60 overflow-y-auto data-[closed]:scale-95 data-[closed]:transform data-[closed]:opacity-0 data-[enter]:duration-100 data-[enter]:ease-out data-[leave]:duration-75 data-[leave]:ease-in dark:border-gray-700 dark:bg-gray-800 dark:ring-white/10"
                >
                  {PLACEMENT_OPTIONS.map((option) => (
                    <MenuItem key={option.value}>
                      {({ focus }) => (
                        <button
                          type="button"
                          onClick={() => handlePlacementChange(option.value)}
                          className={`flex w-full items-center px-4 py-2 text-left text-base sm:text-sm transition ${
                            option.value === form.placement
                              ? 'bg-gray-100 font-semibold text-gray-900 dark:bg-white/10 dark:text-white'
                              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white'
                          } ${focus ? 'outline-none ring-2 ring-gray-200 dark:ring-white/10' : ''}`}
                        >
                          {option.label}
                        </button>
                      )}
                    </MenuItem>
                  ))}
                </MenuItems>
              </Menu>
              {errors.tattoo_placement ? (
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                  {errors.tattoo_placement}
                </p>
              ) : null}
            </div>
            <div ref={sizeRef}>
              <label
                htmlFor="booking-size"
                className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
              >
                Approximate size *
              </label>
              <Menu as="div" className="relative mt-2 w-full">
                <MenuButton
                  id="booking-size"
                  className="flex w-full items-center justify-between gap-x-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-left text-lg sm:text-base font-medium text-gray-900 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-900/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:shadow-none dark:hover:bg-white/5 dark:focus:border-gray-500 dark:focus:ring-gray-700/40 sm:text-base"
                >
                  <span>{SIZE_OPTIONS.find((option) => option.value === form.size)?.label ?? 'Select size'}</span>
                  <ChevronDownIcon aria-hidden="true" className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                </MenuButton>
                <MenuItems
                  transition
                  className="absolute z-10 mt-2 w-full origin-top rounded-xl border border-gray-200 bg-white py-2 shadow-lg ring-1 ring-black/5 focus:outline-none max-h-60 overflow-y-auto data-[closed]:scale-95 data-[closed]:transform data-[closed]:opacity-0 data-[enter]:duration-100 data-[enter]:ease-out data-[leave]:duration-75 data-[leave]:ease-in dark:border-gray-700 dark:bg-gray-800 dark:ring-white/10"
                >
                  {SIZE_OPTIONS.map((option) => (
                    <MenuItem key={option.value}>
                      {({ focus }) => (
                        <button
                          type="button"
                          onClick={() => handleSizeChange(option.value)}
                          className={`flex w-full items-center px-4 py-2 text-left text-base sm:text-sm transition ${
                            option.value === form.size
                              ? 'bg-gray-100 font-semibold text-gray-900 dark:bg-white/10 dark:text-white'
                              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white'
                          } ${focus ? 'outline-none ring-2 ring-gray-200 dark:ring-white/10' : ''}`}
                        >
                          {option.label}
                        </button>
                      )}
                    </MenuItem>
                  ))}
                </MenuItems>
              </Menu>
              {errors.tattoo_size ? (
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                  {errors.tattoo_size}
                </p>
              ) : null}
            </div>
          </div>
          <div>
            <label
              htmlFor="booking-placement-notes"
              className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
            >
              Placement notes (optional)
            </label>
            <textarea
              id="booking-placement-notes"
              name="placement_notes"
              value={form.placement_notes}
              onChange={handleChange('placement_notes')}
              rows={3}
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
              placeholder="Describe exact placement or any considerations for sizing."
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                Suggested session length
              </p>
              <span className="text-xs uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
                {formatDurationLabel(suggestedMinutes)}
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {durationOptions.map((minutes) => {
                const isActive = durationMinutes === minutes;
                const isRecommended = minutes === suggestedMinutes;
                return (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => handleDurationSelect(minutes)}
                    className={classNames(
                      'flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition',
                      isActive
                        ? 'border-gray-900 bg-gray-900 text-white shadow-sm dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-900 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-400 dark:hover:text-gray-100'
                    )}
                    aria-pressed={isActive}
                  >
                    <span className="whitespace-nowrap">{formatDurationLabel(minutes)}</span>
                    {isRecommended ? (
                      <span
                        className={classNames(
                          'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]',
                          isActive
                            ? 'border-white text-white dark:border-gray-900 dark:text-gray-900'
                            : 'border-gray-400 text-gray-500 dark:border-gray-500 dark:text-gray-300'
                        )}
                      >
                        Recommended
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 rounded-2xl border border-gray-200 bg-white/80 p-3 text-sm text-gray-900 shadow-sm dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                Estimated session cost
              </p>
              {pricingLoading ? (
                <p className="mt-2 text-xs text-gray-500">Calculating price...</p>
              ) : pricingError ? (
                <p className="mt-2 text-xs text-rose-500 dark:text-rose-400">{pricingError}</p>
              ) : estimatedTotalLabel ? (
                <div className="mt-2 flex items-baseline justify-between gap-3">
                  <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{estimatedTotalLabel}</span>
                  {serverHourlyRateLabel ? (
                    <span className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                      Hourly rate: {serverHourlyRateLabel}
                    </span>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Select a session length to view pricing computed on the server.
                </p>
              )}
              <p className="mt-2 text-xs uppercase tracking-[0.25em] text-gray-400 dark:text-gray-500">
                Totals always come from the API so pricing stays consistent.
              </p>
            </div>
          </div>

          <div ref={scheduleRef} className="space-y-4 rounded-2xl border border-gray-200 p-4 dark:border-gray-800 dark:bg-gray-950">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                Schedule your session
              </p>
              <span className="text-xs uppercase tracking-[0.3em] text-gray-400 dark:text-gray-500">
                {formattedSelectedDate || 'No date selected'}
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => canGoPrev && setCalendarMonth((prev) => shiftMonth(prev, -1))}
                  disabled={!canGoPrev}
                  className={classNames(
                    'rounded-full border border-gray-300 px-2 py-1 text-xs uppercase tracking-[0.3em] text-gray-600 transition hover:border-gray-900 hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-400 dark:hover:text-gray-100',
                    !canGoPrev && 'cursor-not-allowed opacity-40'
                  )}
                >
                  Prev
                </button>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-600 dark:text-gray-300">
                  {MONTH_FORMATTER.format(calendarMonth)}
                </p>
                <button
                  type="button"
                  onClick={() => canGoNext && setCalendarMonth((prev) => shiftMonth(prev, 1))}
                  disabled={!canGoNext}
                  className={classNames(
                    'rounded-full border border-gray-300 px-2 py-1 text-xs uppercase tracking-[0.3em] text-gray-600 transition hover:border-gray-900 hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-400 dark:hover:text-gray-100',
                    !canGoNext && 'cursor-not-allowed opacity-40'
                  )}
                >
                  Next
                </button>
              </div>
              <div className="grid grid-cols-7 gap-2 text-center text-[11px] uppercase tracking-[0.3em] text-gray-400 dark:text-gray-500">
                {WEEKDAY_HEADERS.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">{calendarDays.map(renderCalendarDay)}</div>
              {availabilityError ? (
                <p className="text-xs uppercase tracking-[0.3em] text-rose-500 dark:text-rose-400">{availabilityError}</p>
              ) : null}
              {errors.selected_date ? (
                <p className="text-xs uppercase tracking-[0.2em] text-rose-500 dark:text-rose-400">{errors.selected_date}</p>
              ) : null}
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                Available times
              </p>
              {slotsLoading ? (
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Loading slots…</p>
              ) : null}
              {slotsError ? (
                <p className="text-xs uppercase tracking-[0.2em] text-rose-500 dark:text-rose-400">{slotsError}</p>
              ) : null}
              {!slotsLoading && !availableSlots.length ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-3 text-xs uppercase tracking-[0.2em] text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  {slotsMeta.isClosed
                    ? 'The studio is closed on this date.'
                    : slotsMeta.fullyBooked
                    ? 'This date is fully booked. Try another day.'
                    : 'Select a date to view available times.'}
                </div>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {availableSlots.map((slot) => {
                  const isActive = selectedSlot?.start === slot.start;
                  return (
                    <button
                      key={slot.start}
                      type="button"
                      onClick={() => handleSlotSelect(slot)}
                      className={classNames(
                        'rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition',
                        isActive
                          ? 'border-gray-900 bg-gray-900 text-white shadow-sm dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-900 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-400 dark:hover:text-gray-100'
                      )}
                    >
                      <span>{TIME_FORMATTER.format(new Date(slot.start))}</span>
                      <span className="ml-2 text-gray-400 dark:text-gray-500">({formatDurationLabel(slot.duration)})</span>
                    </button>
                  );
                })}
              </div>
              {errors.scheduled_start ? (
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                  {errors.scheduled_start}
                </p>
              ) : null}
            </div>
          </div>

          <div ref={identityRef}>
            {shouldSkipIdentityUpload ? (
              <Card className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Your government ID is already verified and stored securely. Upload a fresh copy only if your ID has
                  changed.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button type="button" variant="secondary" onClick={() => setForceIdentityUpdate(true)}>
                    Upload updated ID
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                {hasStoredIdentity ? (
                  <button
                    type="button"
                    onClick={() => setForceIdentityUpdate(false)}
                    className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 underline-offset-4 hover:underline dark:text-gray-400"
                  >
                    Use ID already on file
                  </button>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="booking-id-front"
                      className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
                    >
                      Government ID (front) *
                    </label>
                    <input
                      id="booking-id-front"
                      name="id_front"
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/heic,image/heif,image/webp"
                      onChange={handleFileChange('idFront')}
                      className="sr-only"
                      aria-describedby="booking-id-front-help"
                      required
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <Button as="label" htmlFor="booking-id-front">
                        Upload front ID
                      </Button>
                      <p id="booking-id-front-help" className="text-xs text-gray-500 dark:text-gray-400">
                        {files.idFront
                          ? `${files.idFront.name} · ${formatFileSize(files.idFront.size)}`
                          : 'Accepted: PNG, JPG, HEIC, WebP.'}
                      </p>
                    </div>
                    {files.idFront ? (
                      <img
                        src={files.idFront.previewUrl}
                        alt="Government ID front preview"
                        className="mt-3 h-28 w-44 rounded-xl border border-gray-200 object-cover object-center dark:border-gray-700"
                      />
                    ) : null}
                    {errors.id_front ? (
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                        {errors.id_front}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label
                      htmlFor="booking-id-back"
                      className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
                    >
                      Government ID (back) *
                    </label>
                    <input
                      id="booking-id-back"
                      name="id_back"
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/heic,image/heif,image/webp"
                      onChange={handleFileChange('idBack')}
                      className="sr-only"
                      aria-describedby="booking-id-back-help"
                      required
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <Button as="label" htmlFor="booking-id-back">
                        Upload back ID
                      </Button>
                      <p id="booking-id-back-help" className="text-xs text-gray-500 dark:text-gray-400">
                        {files.idBack
                          ? `${files.idBack.name} · ${formatFileSize(files.idBack.size)}`
                          : 'Ensure details are readable.'}
                      </p>
                    </div>
                    {files.idBack ? (
                      <img
                        src={files.idBack.previewUrl}
                        alt="Government ID back preview"
                        className="mt-3 h-28 w-44 rounded-xl border border-gray-200 object-cover object-center dark:border-gray-700"
                      />
                    ) : null}
                    {errors.id_back ? (
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                        {errors.id_back}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div ref={inspirationRef}>
            <label
              htmlFor="booking-inspiration"
              className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
            >
              Inspiration images (up to 3 files)
            </label>
            <input
              id="booking-inspiration"
              name="inspiration"
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/heic,image/heif,image/webp"
              multiple
              onChange={handleFileChange('inspiration')}
              className="sr-only"
              aria-describedby="booking-inspiration-help"
            />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Button as="label" htmlFor="booking-inspiration" variant="secondary">
                Upload inspiration
              </Button>
              <p id="booking-inspiration-help" className="text-xs text-gray-500 dark:text-gray-400">
                {files.inspiration.length
                  ? `${files.inspiration.length} file${files.inspiration.length > 1 ? 's' : ''} selected`
                  : 'Alternatively, describe your idea below.'}
              </p>
            </div>
            {files.inspiration.length ? (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {files.inspiration.map((file) => (
                  <figure
                    key={file.name}
                    className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                  >
                    <img
                      src={file.previewUrl}
                      alt={`Inspiration preview ${file.name}`}
                      className="h-28 w-full object-cover object-center"
                    />
                    <figcaption className="truncate px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                      {file.name}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : null}
          </div>
          <div>
            <label
              htmlFor="booking-description"
              className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
            >
              Written description {files.inspiration.length ? '(optional)' : '*'}
            </label>
            <textarea
              id="booking-description"
              name="description"
              value={form.description}
              onChange={handleDescriptionChange}
              rows={4}
              inputMode="text"
              autoCapitalize="sentences"
              autoComplete="off"
              autoCorrect="on"
              spellCheck
              ref={descriptionRef}
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
              placeholder="Share themes, lettering, or any details that help us understand your idea."
              required={!files.inspiration.length}
            />
            {errors.description ? (
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                {errors.description}
              </p>
            ) : null}
          </div>

          {isAuthenticated ? (
            <div className="space-y-2 rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
              <p>
                Booking as <span className="font-semibold">{account?.display_name || account?.email}</span>. Your account
                keeps files and notes linked for future sessions.
              </p>
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-dashed border-gray-300 p-4 dark:border-gray-700">
              <label className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                <input
                  id="booking-create-account"
                  name="create_account"
                  type="checkbox"
                  checked={form.create_account}
                  onChange={handleChange('create_account')}
                  className="h-4 w-4 rounded border border-gray-400 text-gray-900 focus:ring-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:focus:ring-gray-400"
                />
                Create a client account for future bookings
              </label>
              {form.create_account ? (
                <div ref={passwordRef}>
                  <label
                    htmlFor="booking-password"
                    className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
                  >
                    Set password *
                  </label>
                  <input
                    id="booking-password"
                    name="password"
                    type="password"
                    value={form.password}
                    onChange={handleChange('password')}
                    autoComplete="new-password"
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
                    required
                  />
                  {errors.password ? (
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">{errors.password}</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Continue as a guest if you prefer one-time document sharing. Assets remain encrypted and accessible to you
                  during follow-ups.
                </p>
              )}
            </div>
          )}
          {errors.files ? (
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">{errors.files}</p>
          ) : null}

          <div className="space-y-2 rounded-2xl border border-dashed border-gray-300 p-4 dark:border-gray-700">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
              Booking deposit {depositAmountLabel ? `(${depositAmountLabel})` : ''}
            </p>
            {paymentConfig?.enabled ? (
              <>
                <div
                  ref={cardContainerRef}
                  className="min-h-[72px] rounded-xl border border-gray-300 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Securely processed by Square. We only charge the deposit after you confirm this booking.
                </p>
                {availableWallets.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                      Or choose another payment method
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {availableWallets.map((wallet) => (
                        <button
                          key={wallet.id}
                          type="button"
                          className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 transition hover:border-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-gray-400"
                          onClick={() => handleWalletPayment(wallet.id)}
                          disabled={submitting || walletProcessing !== null}
                        >
                          {wallet.label}
                        </button>
                      ))}
                    </div>
                    {walletProcessing ? (
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                        Processing payment…
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : paymentConfig?.demo_mode ? (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Demo payments are enabled, so no card entry is required in this environment.
              </p>
            ) : paymentsUnavailable ? (
              <p className="text-sm text-rose-500 dark:text-rose-400">
                Payments are temporarily unavailable. Please email blackworknyc@gmail.com to complete your booking.
              </p>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-300">Loading the secure payment form…</p>
            )}
            {paymentError ? (
              <p className="text-xs uppercase tracking-[0.2em] text-rose-500 dark:text-rose-400">{paymentError}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <Button type="submit" disabled={submitDisabled}>
              {submitLabel}
            </Button>
            <Button as={Link} to="/" variant="secondary" disabled={submitting}>
              Cancel
            </Button>
          </div>
          <Card className="flex flex-col gap-6 mt-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Booking requests include secure document intake so we can prep custom design time and confirm age
                requirements before meeting. Files stay encrypted and only our studio can view them unless you toggle
                otherwise. A fully refundable Square deposit locks in your time slot.
              </p>
              <ul className="space-y-1">{requirementList}</ul>
            </div>
            <div className="rounded-2xl border border-dashed border-gray-300 p-4 text-xs uppercase tracking-[0.2em] text-gray-500 dark:border-gray-700 dark:text-gray-400">
              Need help? Email{' '}
              <a href="mailto:blackworknyc@gmail.com" className="underline hover:text-gray-900 dark:hover:text-gray-100">
                blackworknyc@gmail.com
              </a>
            </div>
          </Card>
        </FadeIn>
      </div>
    </main>
  );
}
