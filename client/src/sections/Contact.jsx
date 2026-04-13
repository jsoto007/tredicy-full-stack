import { useEffect, useMemo, useState } from 'react';
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
      const startLabel = WEEKDAY_ORDER[range.start]?.label?.substring(0, 3) ?? '';
      const endLabel = WEEKDAY_ORDER[range.end]?.label?.substring(0, 3) ?? '';
      const dayLabel = range.start === range.end ? startLabel : `${startLabel}–${endLabel}`;
      summary.push({
        dayLabel,
        timeLabel: is_open ? formatTimeRange(open_time, close_time) : 'Closed',
        startIndex: range.start
      });
    });
  });
  return summary.sort((a, b) => a.startIndex - b.startIndex);
}

const CONTACT_POINTS = [
  {
    id: 'location',
    heading: 'Location',
    value: (
      <a
        href="https://maps.google.com/?q=104+Kraft+Ave+Bronxville+NY+10708"
        target="_blank"
        rel="noopener noreferrer"
        className="font-heading text-xl font-medium text-ts-charcoal leading-tight hover:text-ts-crimson transition-colors duration-200"
      >
        <span className="block">104 Kraft Ave</span>
        <span className="block text-ts-charcoal/70 mt-0.5">Bronxville, NY 10708</span>
      </a>
    ),
    body: 'Located in the heart of Bronxville village. Metered street parking available; Metro-North accessible (Bronxville station, 5 min walk).',
    href: 'https://maps.google.com/?q=104+Kraft+Ave+Bronxville+NY+10708',
    hrefLabel: 'Get directions in Google Maps',
    linkText: 'Get directions',
  },
  {
    id: 'hours',
    heading: 'Hours',
    defaultText: 'Loading operating hours...',
    body: 'We recommend reserving ahead on weekends. Private dining available by arrangement.',
  },
  {
    id: 'contact',
    heading: 'Contact',
    value: (
      <a
        href="tel:+19145550013"
        className="font-heading text-xl font-medium text-ts-charcoal hover:text-ts-crimson transition-colors duration-200"
      >
        (914) 555-0013
      </a>
    ),
    body: 'Call for same-day reservations, large party inquiries, or general questions. Email us at hello@tredicisocial.com.',
    href: 'tel:+19145550013',
    hrefLabel: 'Call Tredici Social',
    linkText: 'Call now',
  },
];

export default function Visit() {
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
        // Fallback gracefully
      }
    }

    loadHours();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const summaryRows = useMemo(() => buildSummary(hours), [hours]);
  const hoursText = summaryRows.length > 0 
    ? summaryRows.filter(r => r.timeLabel !== 'Closed').map(r => `${r.dayLabel} ${r.timeLabel}`).join(' · ')
    : 'Hours loading...';

  return (
    <section id="visit" className="bg-ts-cream py-20">
      <FadeIn className="mx-auto flex max-w-7xl flex-col gap-12 px-6" delayStep={0.14}>
        <SectionTitle
          eyebrow="Plan Your Visit"
          title="Find us in Bronxville"
          description="Tredici Social is located in the heart of the Bronxville village. Come hungry, stay late."
        />

        <FadeIn className="grid gap-6 md:grid-cols-3" childClassName="h-full" delayStep={0.1}>
          {CONTACT_POINTS.map((point) => (
            <Card key={point.id} className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.45em] text-ts-crimson">
                {point.heading}
              </p>
              {point.id === 'hours' ? (
                <div className="flex flex-col gap-1">
                  {summaryRows.length > 0 ? (
                    summaryRows.filter(r => r.timeLabel !== 'Closed').map((r) => (
                      <div key={r.dayLabel} className="flex justify-between items-center text-base py-0.5 border-b border-black/5 last:border-0">
                        <span className="text-ts-charcoal/80 font-normal text-sm">{r.dayLabel}</span>
                        <span className="font-heading text-base font-medium text-ts-crimson">{r.timeLabel}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-ts-muted">{point.defaultText}</p>
                  )}
                </div>
              ) : (
                point.value
              )}
              <p className="text-sm leading-relaxed text-ts-muted">{point.body}</p>
              {point.href && (
                <a
                  href={point.href}
                  target={point.id === 'location' ? '_blank' : undefined}
                  rel={point.id === 'location' ? 'noopener noreferrer' : undefined}
                  aria-label={point.hrefLabel}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-ts-crimson underline-offset-4 transition hover:underline"
                >
                  {point.linkText}
                  <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M1 6h10M7 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              )}
            </Card>
          ))}
        </FadeIn>

        {/* Directions card */}
        <a
          href="https://maps.google.com/?q=104+Kraft+Ave,+Bronxville,+NY+10708"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Get directions to Tredici Social — opens in your maps app"
          className="group flex items-center justify-between gap-6 rounded-2xl border border-ts-stone bg-white px-8 py-7 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-ts-crimson hover:shadow-card-hover"
        >
          <div className="flex items-center gap-5">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ts-crimson/10 text-ts-crimson transition group-hover:bg-ts-crimson group-hover:text-white">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
            </span>
            <div>
              <p className="font-heading text-xl font-medium text-ts-charcoal">Get Directions</p>
              <p className="mt-0.5 text-sm text-ts-muted">104 Kraft Ave, Bronxville, NY 10708</p>
            </div>
          </div>
          <svg className="h-5 w-5 shrink-0 text-ts-stone transition group-hover:translate-x-1 group-hover:text-ts-crimson" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </a>
      </FadeIn>
    </section>
  );
}
