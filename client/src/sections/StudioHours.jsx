import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import FadeIn from '../components/FadeIn.jsx';
import Card from '../components/Card.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
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

const DEFAULT_DESCRIPTION = `Private, appointment-only sessions designed through collaborative consultations that honor your story and a refined blackwork aesthetic.`;

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
  const [hours, setHours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
        console.error('Studio hours fetch failed', loadError);
        setError('Unable to load studio hours right now.');
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
  }, []);

  const summaryRows = useMemo(() => buildSummary(hours), [hours]);
  const showFallback = !summaryRows.length && !loading && !error;

  return (
    <section id="hours" className="bg-white text-gray-900 dark:bg-black dark:text-white">
      <FadeIn className="mx-auto flex w-full max-w-5xl justify-center px-6 py-16" delayStep={0.18}>
        <Card className="space-y-6 border border-gray-200/30 bg-white/90 px-8 py-10 shadow-2xl shadow-black/10 dark:border-white/10 dark:bg-black/80">
          <SectionTitle
            eyebrow="Studio hours"
            title="Studio availability"
            description="Our availability updates in real-time. Please book an appointment to begin your custom piece."
            align="center"
          />
          <div className="flex justify-center">
            <Link
              to="/share-your-idea"
              className="inline-flex items-center gap-2 rounded-full border border-gray-900 px-6 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-200 dark:border-white/30 dark:bg-white/0 dark:text-white dark:hover:bg-white/10"
            >
              Book Appointment <span className="text-lg">→</span>
            </Link>
          </div>
          <div className="space-y-4 text-center">
            {loading ? (
              <p className="text-sm uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Loading studio hours…</p>
            ) : error ? (
              <p className="text-sm uppercase tracking-[0.3em] text-rose-500">{error}</p>
            ) : showFallback ? (
              <p className="text-sm uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">Currently not accepting walk-ins. </p>
            ) : null}
          </div>
          <p className="text-sm md:text-base leading-relaxed text-gray-500 dark:text-gray-400 max-w-xl mx-auto border-t border-gray-200/40 dark:border-white/10 pt-6 mt-2 text-center">
            {DEFAULT_DESCRIPTION}
          </p>
        </Card>
      </FadeIn>
    </section>
  );
}
