import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import FadeIn from '../components/FadeIn.jsx';
import Card from '../components/Card.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { apiGet } from '../lib/api.js';

const WEEKDAY_ORDER = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' }
];
const WEEKDAY_INDEX = WEEKDAY_ORDER.reduce((acc, entry, index) => {
  acc[entry.key] = index;
  return acc;
}, {});

const TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit'
});

function formatTimeValue(value) {
  if (!value) {
    return null;
  }
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }
  const dateValue = new Date();
  dateValue.setHours(hours, minutes, 0, 0);
  return TIME_FORMATTER.format(dateValue);
}

function formatTimeRange(openTime, closeTime) {
  const start = formatTimeValue(openTime);
  const end = formatTimeValue(closeTime);
  if (start && end) {
    return `${start} – ${end}`;
  }
  if (start) {
    return start;
  }
  if (end) {
    return end;
  }
  return 'Hours coming soon';
}

function splitIntoRanges(indexes) {
  const ranges = [];
  if (!indexes.length) {
    return ranges;
  }
  let rangeStart = indexes[0];
  let prev = indexes[0];
  for (let i = 1; i < indexes.length; i += 1) {
    const current = indexes[i];
    if (current === prev + 1) {
      prev = current;
      continue;
    }
    ranges.push({ start: rangeStart, end: prev });
    rangeStart = current;
    prev = current;
  }
  ranges.push({ start: rangeStart, end: prev });
  return ranges;
}

function buildSummary(hours) {
  const openEntries = (hours || [])
    .filter((entry) => entry?.is_open)
    .map((entry) => ({
      originalDay: entry.day,
      open_time: entry.open_time,
      close_time: entry.close_time,
      index: WEEKDAY_INDEX[String(entry.day || '').toLowerCase()]
    }))
    .filter((entry) => Number.isFinite(entry.index));

  if (!openEntries.length) {
    return [];
  }

  const byTime = new Map();
  openEntries.forEach((entry) => {
    const key = `${entry.open_time || ''}|${entry.close_time || ''}`;
    const bucket = byTime.get(key) || {
      open_time: entry.open_time,
      close_time: entry.close_time,
      indexes: []
    };
    bucket.indexes.push(entry.index);
    byTime.set(key, bucket);
  });

  const summary = [];
  byTime.forEach(({ open_time, close_time, indexes }) => {
    const uniqueIndexes = Array.from(new Set(indexes)).sort((a, b) => a - b);
    const ranges = splitIntoRanges(uniqueIndexes);
    ranges.forEach((range) => {
      const startLabel = WEEKDAY_ORDER[range.start]?.label ?? WEEKDAY_ORDER[range.start]?.key ?? '';
      const endLabel = WEEKDAY_ORDER[range.end]?.label ?? WEEKDAY_ORDER[range.end]?.key ?? '';
      const dayLabel = range.start === range.end ? startLabel : `${startLabel} - ${endLabel}`;
      summary.push({
        dayLabel,
        timeLabel: formatTimeRange(open_time, close_time),
        startIndex: range.start
      });
    });
  });
  return summary.sort((a, b) => a.startIndex - b.startIndex);
}

export default function StudioHours() {
  const { isSpanish } = useLanguage();
  const [hours, setHours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const copy = isSpanish
    ? {
        eyebrow: 'Horario',
        title: 'Disponibilidad de citas',
        description:
          'La disponibilidad se actualiza en tiempo real segun la duracion del servicio para que cada reserva tenga el tiempo correcto.',
        cta: 'Reservar cita',
        loading: 'Cargando horario del salon...',
        fallback: 'Actualmente no aceptamos visitas sin cita.',
        defaultDescription:
          'Melodi Nails trabaja con cita previa para que cada manicure, pedicure o servicio de acrilico tenga el tiempo necesario para una buena preparacion, detalle y acabado pulido.',
        error: 'No se pudo cargar el horario del salon en este momento.',
      }
    : {
        eyebrow: 'Hours',
        title: 'Appointment availability',
        description:
          'Availability updates in real-time based on service duration, so each booking has the right amount of time.',
        cta: 'Book Appointment',
        loading: 'Loading studio hours...',
        fallback: 'Currently not accepting walk-ins.',
        defaultDescription:
          'Melodi Nails works by appointment so each manicure, pedicure, or acrylic service has enough time for proper prep, detail work, and a polished finish.',
        error: 'Unable to load studio hours right now.',
      };

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadHours() {
      try {
        const data = await apiGet('/api/availability/config', { signal: controller.signal });
        if (!isMounted) {
          return;
        }
        const operatingHours = Array.isArray(data?.operating_hours) ? data.operating_hours : [];
        setHours(operatingHours);
        setError('');
      } catch (loadError) {
        if (!isMounted) {
          return;
        }
        setError(copy.error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadHours();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [copy.error]);

  const summaryRows = useMemo(() => buildSummary(hours), [hours]);
  const showFallback = !summaryRows.length && !loading && !error;

  return (
    <section id="hours" className="bg-[#fffaf5] text-[#23301d]">
      <FadeIn className="mx-auto flex w-full max-w-5xl justify-center px-6 py-16" delayStep={0.18}>
        <Card className="space-y-6 border border-[#dbc9b4]/60 bg-[#fffdf9]/95 px-8 py-10 shadow-[0_20px_60px_rgba(42,57,35,0.10)]">
          <SectionTitle
            eyebrow={copy.eyebrow}
            title={copy.title}
            description={copy.description}
            align="center"
          />
          <div className="flex justify-center">
            <Link
              to="/appointments/new"
              className="inline-flex items-center gap-2 rounded-full border border-[#2a3923] px-6 py-2 text-sm font-medium text-[#2a3923] transition hover:bg-[#f3e7d9]"
            >
              {copy.cta} <span className="text-lg">→</span>
            </Link>
          </div>
          <div className="space-y-4 text-center">
            {loading ? (
              <p className="text-sm uppercase tracking-[0.3em] text-[#6f7863]">{copy.loading}</p>
            ) : error ? (
              <p className="text-sm uppercase tracking-[0.3em] text-rose-500">{error}</p>
            ) : showFallback ? (
              <p className="text-sm uppercase tracking-[0.3em] text-[#6f7863]">{copy.fallback}</p>
            ) : null}
          </div>
          <p className="mx-auto mt-2 max-w-xl border-t border-[#dbc9b4]/60 pt-6 text-center text-sm leading-relaxed text-[#5e6755] md:text-base">
            {copy.defaultDescription}
          </p>
        </Card>
      </FadeIn>
    </section>
  );
}
