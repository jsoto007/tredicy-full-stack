import { useCallback, useEffect, useMemo, useState } from 'react';
import FadeIn from '../components/FadeIn.jsx';
import Button from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import Dialog from '../components/Dialog.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import { apiGet, apiPost } from '../lib/api.js';

const SLOT_INTERVAL_MINUTES = 60;
const JS_DAY_SLUGS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const DAY_FORMATTER = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const TIME_FORMATTER = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const MAX_MONTH_HORIZON = 5;

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
  neck: 150,
  chest: 180,
  back: 240,
  full_sleeve: 300
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
  { value: 'neck', label: 'Neck' }
];

const SIZE_OPTIONS = [
  { value: 'small', label: 'Small (palm-sized)' },
  { value: 'medium', label: 'Medium (quarter sleeve / ~6")' },
  { value: 'large', label: 'Large (half sleeve / panel)' },
  { value: 'xl', label: 'Extended (full back or similar)' }
];

const REQUIREMENTS = [
  'Upload clear front and back photos of your government-issued ID.',
  'Share inspiration imagery (up to three files) or include a written description.',
  'Pick a preferred date and one-hour slot using the live studio calendar.',
  'Optionally create a client account to keep your documents on file.'
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

function calculateSuggestedDurationMinutes(placement, size, minimum = SLOT_INTERVAL_MINUTES) {
  const base = PLACEMENT_BASE_MINUTES[placement] ?? 120;
  const multiplier = SIZE_MULTIPLIERS[size] ?? 1;
  const blocks = Math.max(1, Math.ceil((base * multiplier) / SLOT_INTERVAL_MINUTES));
  const minutes = blocks * SLOT_INTERVAL_MINUTES;
  return minutes < minimum ? minimum : minutes;
}

function formatDurationLabel(minutes) {
  const hours = minutes / 60;
  return hours === 1 ? '1 hour' : `${hours} hours`;
}

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function Booking() {
  const today = useMemo(() => startOfDay(new Date()), []);
  const minMonth = useMemo(() => startOfMonth(today), [today]);
  const maxMonth = useMemo(() => shiftMonth(minMonth, MAX_MONTH_HORIZON), [minMonth]);

  const [open, setOpen] = useState(false);
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

  const minimumDuration = availabilityConfig?.minimumDurationMinutes ?? SLOT_INTERVAL_MINUTES;

  const requirementList = useMemo(
    () =>
      REQUIREMENTS.map((item, index) => (
        <li key={index} className="text-xs uppercase tracking-[0.25em] text-gray-500 dark:text-gray-400">
          {item}
        </li>
      )),
    []
  );

  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);

  const durationOptions = useMemo(() => {
    const options = new Set();
    const upperBound = SLOT_INTERVAL_MINUTES * 6;
    for (let minutes = minimumDuration; minutes <= upperBound; minutes += SLOT_INTERVAL_MINUTES) {
      options.add(minutes);
    }
    options.add(suggestedMinutes);
    return Array.from(options).sort((a, b) => a - b);
  }, [minimumDuration, suggestedMinutes]);

  const formattedSelectedDate = selectedDate ? DAY_FORMATTER.format(parseDateKey(selectedDate)) : '';
  const canGoPrev = calendarMonth.getTime() > minMonth.getTime();
  const canGoNext = calendarMonth.getTime() < maxMonth.getTime();

  const loadAvailabilityConfig = useCallback(async () => {
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
  }, []);

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
        if (form.placement) {
          params.set('placement', form.placement);
        }
        if (form.size) {
          params.set('size', form.size);
        }
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
    setForm(createInitialForm());
    setFiles(createInitialFiles());
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
  }, [availabilityConfig, minMonth]);

  useEffect(() => {
    if (open && !availabilityConfig && !availabilityLoading) {
      loadAvailabilityConfig();
    }
  }, [open, availabilityConfig, availabilityLoading, loadAvailabilityConfig]);

  useEffect(() => {
    if (!availabilityConfig) {
      return;
    }
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
      availabilityConfig.minimumDurationMinutes
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

  const handlePlacementChange = (event) => {
    const value = event.target.value;
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

  const handleSizeChange = (event) => {
    const value = event.target.value;
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

  const handleFileChange = (field) => async (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) {
      setFiles((prev) => ({
        ...prev,
        [field]: field === 'inspiration' ? [] : null
      }));
      return;
    }

    try {
      if (field === 'inspiration') {
        const uploads = await Promise.all(
          selectedFiles.slice(0, 3).map(async (file) => ({
            name: file.name,
            dataUrl: await readFileAsDataUrl(file)
          }))
        );
        setFiles((prev) => ({
          ...prev,
          inspiration: uploads
        }));
      } else {
        const file = selectedFiles[0];
        const dataUrl = await readFileAsDataUrl(file);
        setFiles((prev) => ({
          ...prev,
          [field]: {
            name: file.name,
            dataUrl
          }
        }));
      }
      setErrors((prev) => {
        const next = { ...prev };
        if (field === 'inspiration') {
          delete next.description;
        } else if (field === 'idFront') {
          delete next.id_front;
        } else if (field === 'idBack') {
          delete next.id_back;
        }
        return next;
      });
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        files: 'Unable to read selected file(s).'
      }));
    } finally {
      event.target.value = '';
    }
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
    if (!files.idFront) {
      validationErrors.id_front = 'Required';
    }
    if (!files.idBack) {
      validationErrors.id_back = 'Required';
    }
    if (!form.description.trim() && !files.inspiration.length) {
      validationErrors.description = 'Add inspiration details';
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
    return Object.keys(validationErrors).length === 0;
  }, [form, files, selectedSlot]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) {
      return;
    }

    setSubmitting(true);
    const contactName = `${form.first_name.trim()} ${form.last_name.trim()}`.replace(/\s+/g, ' ').trim();
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
      id_front_url: files.idFront?.dataUrl,
      id_back_url: files.idBack?.dataUrl,
      inspiration_urls: files.inspiration.map((file) => file.dataUrl)
    };

    if (form.create_account) {
      payload.password = form.password;
    }

    try {
      const response = await apiPost('/api/appointments', payload);
      const reference = response?.reference_code || 'Pending assignment';
      setNotice(`Appointment received - reference ${reference}. We will confirm within two business days.`);
      setNoticeTone('success');
      resetBookingState();
      setOpen(false);
    } catch (error) {
      setNotice('Request saved locally. We will follow up once connected.');
      setNoticeTone('offline');
    } finally {
      setSubmitting(false);
    }
  };

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
        type='button'
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
    <section id="booking" className="bg-white py-16 text-gray-900 dark:bg-black dark:text-gray-100">
      <FadeIn className="mx-auto flex max-w-6xl flex-col gap-12 px-6" delayStep={0.18}>
        <SectionTitle
          eyebrow="Booking"
          title="Reserve your session"
          description="Share your idea, upload ID verification, and lock in a working hour that fits your schedule."
        />
        <Card className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Booking requests now include secure document intake so we can prepare custom design time and confirm age
              requirements before meeting. Files are encrypted at rest and visible only to our team unless you toggle
              otherwise.
            </p>
            <ul className="space-y-1">{requirementList}</ul>
          </div>
          <Button type="button" onClick={() => setOpen(true)}>
            Start Booking
          </Button>
        </Card>
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
      </FadeIn>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Share your idea"
        footer={
          <>
            <Button type="submit" form="booking-form" disabled={submitting}>
              {submitting ? 'Sending...' : 'Submit booking'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
          </>
        }
      >
        <FadeIn as="form" id="booking-form" className="space-y-6" onSubmit={handleSubmit} immediate delayStep={0.08}>
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
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
                required
              />
              {errors.last_name ? (
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                  {errors.last_name}
                </p>
              ) : null}
            </div>
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
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
                required
              />
              {errors.email ? (
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                  {errors.email}
                </p>
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
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
              />
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-gray-200 p-4 dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                Tattoo details
              </p>
              <p className="text-[11px] uppercase tracking-[0.3em] text-gray-400 dark:text-gray-500">Plan & scope</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="booking-placement"
                  className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
                >
                  Placement *
                </label>
                <select
                  id="booking-placement"
                  value={form.placement}
                  onChange={handlePlacementChange}
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm uppercase tracking-[0.1em] text-gray-700 focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
                  required
                >
                  <option value="">Select placement</option>
                  {PLACEMENT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {errors.tattoo_placement ? (
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                    {errors.tattoo_placement}
                  </p>
                ) : null}
              </div>
              <div>
                <label
                  htmlFor="booking-size"
                  className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400"
                >
                  Approximate size *
                </label>
                <select
                  id="booking-size"
                  value={form.size}
                  onChange={handleSizeChange}
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm uppercase tracking-[0.1em] text-gray-700 focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
                  required
                >
                  <option value="">Select size</option>
                  {SIZE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
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
                        'rounded-xl border px-3 py-2 text-sm font-medium transition',
                        isActive
                          ? 'border-gray-900 bg-gray-900 text-white shadow-sm dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-900 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-400 dark:hover:text-gray-100'
                      )}
                    >
                      {formatDurationLabel(minutes)}
                      {isRecommended ? <span className="ml-2 text-xs uppercase tracking-[0.2em]">Recommended</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-gray-200 p-4 dark:border-gray-800 dark:bg-gray-950">
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
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                Available time slots
              </p>
              {!selectedDate ? (
                <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                  Select a date to view open sessions.
                </p>
              ) : null}
              {slotsLoading ? (
                <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Checking availability…</p>
              ) : null}
              {slotsError ? (
                <p className="text-xs uppercase tracking-[0.3em] text-rose-500 dark:text-rose-400">{slotsError}</p>
              ) : null}
              {!slotsLoading && !slotsError && selectedDate ? (
                <>
                  {slotsMeta.isClosed ? (
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                      Studio is closed on the selected date.
                    </p>
                  ) : null}
                  {slotsMeta.fullyBooked && !slotsMeta.isClosed ? (
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                      Fully booked for this day. Try another date.
                    </p>
                  ) : null}
                  {!slotsMeta.isClosed && !slotsMeta.fullyBooked && availableSlots.length ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {availableSlots.map((slot) => {
                        const isActive = selectedSlot?.start === slot.start;
                        const label = TIME_FORMATTER.format(new Date(slot.start));
                        return (
                          <button
                            key={slot.start}
                            type="button"
                            onClick={() => handleSlotSelect(slot)}
                            className={classNames(
                              'rounded-xl border px-3 py-2 text-sm font-medium transition',
                              isActive
                                ? 'border-gray-900 bg-gray-900 text-white shadow-sm dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900'
                                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-900 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-400 dark:hover:text-gray-100'
                            )}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  {!slotsMeta.isClosed && !slotsMeta.fullyBooked && !availableSlots.length ? (
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                      No open sessions for this duration. Try another day or adjust the recommended hours.
                    </p>
                  ) : null}
                </>
              ) : null}
              {errors.scheduled_start ? (
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">{errors.scheduled_start}</p>
              ) : null}
            </div>
          </div>

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
                accept="image/*"
                onChange={handleFileChange('idFront')}
                className="mt-2 block w-full text-sm text-gray-600 dark:text-gray-300"
                required
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {files.idFront ? `Selected: ${files.idFront.name}` : 'Accepted formats: PNG, JPG, HEIC.'}
              </p>
              {errors.id_front ? (
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">{errors.id_front}</p>
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
                accept="image/*"
                onChange={handleFileChange('idBack')}
                className="mt-2 block w-full text-sm text-gray-600 dark:text-gray-300"
                required
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {files.idBack ? `Selected: ${files.idBack.name}` : 'Ensure details are readable.'}
              </p>
              {errors.id_back ? (
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">{errors.id_back}</p>
              ) : null}
            </div>
          </div>
          <div>
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
              accept="image/*"
              multiple
              onChange={handleFileChange('inspiration')}
              className="mt-2 block w-full text-sm text-gray-600 dark:text-gray-300"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {files.inspiration.length
                ? `Selected: ${files.inspiration.map((file) => file.name).join(', ')}`
                : 'Alternatively, you can describe your idea below.'}
            </p>
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
              onChange={handleChange('description')}
              rows={4}
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-gray-900 focus:outline-none focus:ring-0 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-400"
              required={!files.inspiration.length}
            />
            {errors.description ? (
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                {errors.description}
              </p>
            ) : null}
          </div>

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
              <div>
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
          {errors.files ? (
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">{errors.files}</p>
          ) : null}
        </FadeIn>
      </Dialog>
    </section>
  );
}

