import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../lib/api.js';

const year = new Date().getFullYear();

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
  if (!value) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  const dateValue = new Date();
  dateValue.setHours(hours, minutes, 0, 0);
  return TIME_FORMATTER.format(dateValue);
}

function formatTimeRange(openTime, closeTime) {
  const start = formatTimeValue(openTime);
  const end = formatTimeValue(closeTime);
  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  if (end) return end;
  return 'Closed';
}

function splitIntoRanges(indexes) {
  const ranges = [];
  if (!indexes.length) return ranges;
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
  const entries = (hours || [])
    .map((entry) => ({
      originalDay: entry.day,
      is_open: entry.is_open,
      open_time: entry.is_open ? entry.open_time : null,
      close_time: entry.is_open ? entry.close_time : null,
      index: WEEKDAY_INDEX[String(entry.day || '').toLowerCase()]
    }))
    .filter((entry) => Number.isFinite(entry.index));

  if (!entries.length) return [];

  const byTime = new Map();
  entries.forEach((entry) => {
    // Group by exact time strings, or 'closed'
    const key = entry.is_open ? `${entry.open_time || ''}|${entry.close_time || ''}` : 'closed';
    const bucket = byTime.get(key) || {
      is_open: entry.is_open,
      open_time: entry.open_time,
      close_time: entry.close_time,
      indexes: []
    };
    bucket.indexes.push(entry.index);
    byTime.set(key, bucket);
  });

  const summary = [];
  byTime.forEach(({ is_open, open_time, close_time, indexes }) => {
    const uniqueIndexes = Array.from(new Set(indexes)).sort((a, b) => a - b);
    const ranges = splitIntoRanges(uniqueIndexes);
    ranges.forEach((range) => {
      const startLabel = WEEKDAY_ORDER[range.start]?.label ?? '';
      const endLabel = WEEKDAY_ORDER[range.end]?.label ?? '';
      const dayLabel = range.start === range.end ? startLabel : `${startLabel} – ${endLabel}`;
      summary.push({
        dayLabel,
        timeLabel: is_open ? formatTimeRange(open_time, close_time) : 'Closed',
        startIndex: range.start
      });
    });
  });
  return summary.sort((a, b) => a.startIndex - b.startIndex);
}

export default function Footer() {
  const [hours, setHours] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadHours() {
      try {
        const data = await apiGet('/api/availability/config', { signal: controller.signal });
        if (isMounted && Array.isArray(data?.operating_hours)) {
          setHours(data.operating_hours);
        }
      } catch {
        // Fallback gracefully to default empty display if API fails
      }
    }

    loadHours();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const summaryRows = useMemo(() => buildSummary(hours), [hours]);

  return (
    <footer className="bg-ts-charcoal text-ts-light-text">
      {/* Top band */}
      <div className="border-b border-white/10">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-[1.4fr_1fr_1fr] md:gap-8">
          {/* Brand column */}
          <div className="space-y-5">
            <div>
              <p className="font-heading text-2xl font-medium tracking-[0.1em] text-white">Tredici Social</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.45em] text-ts-gold">
                Contemporary Italian · Bronxville, NY
              </p>
            </div>
            <address className="space-y-1 text-sm not-italic leading-relaxed text-ts-light-text/70">
              <p>104 Kraft Ave</p>
              <p>Bronxville, NY 10708</p>
            </address>
            <div className="space-y-1 text-sm text-ts-light-text/70">
              <a
                href="tel:+19145550013"
                className="block transition hover:text-white"
                aria-label="Call Tredici Social"
              >
                (914) 555-0013
              </a>
              <a
                href="mailto:hello@tredicisocial.com"
                className="block transition hover:text-white"
                aria-label="Email Tredici Social"
              >
                hello@tredicisocial.com
              </a>
            </div>
            <a
              href="https://sotodev.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] text-ts-muted underline-offset-4 transition hover:text-ts-gold hover:underline"
            >
              Powered by SotoDev, LLC
            </a>
          </div>

          {/* Hours column */}
          <div className="space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.45em] text-ts-gold">Hours</p>
            <ul className="space-y-2.5 text-sm text-ts-light-text/70">
              {summaryRows.length > 0 ? (
                summaryRows.map(({ dayLabel, timeLabel }) => (
                  <li key={dayLabel} className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                    <span className="font-medium text-ts-light-text/90">{dayLabel}</span>
                    <span>{timeLabel}</span>
                  </li>
                ))
              ) : (
                <li className="text-ts-light-text/50">Loading hours...</li>
              )}
            </ul>
          </div>

          {/* Links column */}
          <div className="space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.45em] text-ts-gold">Explore</p>
            <nav className="flex flex-col gap-3 text-sm text-ts-light-text/70" aria-label="Footer navigation">
              <Link to="/menu" className="transition hover:text-white">
                Menu
              </Link>
              <Link to="/specials" className="transition hover:text-white">
                Specials
              </Link>
              <a
                href="https://www.opentable.com/r/tredici-social-bronxville"
                target="_blank"
                rel="noopener noreferrer"
                className="transition hover:text-white"
              >
                Reservations
              </a>
              <Link to="/private-events" className="transition hover:text-white">
                Private Events
              </Link>
              <Link to="/gallery" className="transition hover:text-white">
                Gallery
              </Link>
              <a href="#about" className="transition hover:text-white">
                About
              </a>
              <a href="#top" className="mt-2 text-ts-muted transition hover:text-ts-gold">
                Back to top ↑
              </a>
            </nav>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-5 text-[11px] text-ts-muted md:flex-row md:items-center md:justify-between">
        <span className="font-semibold uppercase tracking-[0.3em]">© {year} Tredici Social</span>
        <span>104 Kraft Ave · Bronxville, NY 10708</span>
        <Link
          to="/auth"
          className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-ts-light-text/70 transition hover:border-white/40 hover:bg-white/10 hover:text-white"
          aria-label="Staff login"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="5" r="3"/>
            <path d="M1 14s1-4 7-4 7 4 7 4"/>
          </svg>
          Staff Portal
        </Link>
      </div>
    </footer>
  );
}
