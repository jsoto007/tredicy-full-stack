import { useState } from 'react';
import FadeIn from '../components/FadeIn.jsx';
import Card from '../components/Card.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import { apiPost } from '../lib/api.js';

const EVENT_TYPES = [
  'Birthday Celebration',
  'Anniversary Dinner',
  'Corporate Event',
  'Wedding Rehearsal Dinner',
  'Cocktail Reception',
  'Holiday Party',
  'Other',
];

const CAPACITY_INFO = [
  { label: 'Semi-Private', detail: 'Up to 20 guests — reserved section of our dining room' },
  { label: 'Full Buyout', detail: 'Up to 60 guests — exclusive use of the entire restaurant' },
  { label: 'Bar & Patio', detail: 'Up to 30 guests — cocktail reception format' },
];

const defaultForm = {
  name: '',
  email: '',
  phone: '',
  date: '',
  time: '',
  party_size: '',
  event_type: '',
  message: '',
};

export default function PrivateEventsPage() {
  const [form, setForm] = useState(defaultForm);
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');
    try {
      await apiPost('/api/contact/private-events', form);
      setStatus('success');
      setForm(defaultForm);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err?.message || 'Something went wrong. Please try calling us or emailing directly.');
    }
  };

  const inputClass =
    'w-full rounded-xl border border-ts-stone bg-ts-cream px-4 py-3 text-sm text-ts-dark-text placeholder-ts-muted/60 transition focus:border-ts-crimson focus:outline-none focus:ring-2 focus:ring-ts-crimson/20';
  const labelClass = 'block text-[11px] font-semibold uppercase tracking-[0.35em] text-ts-muted mb-1.5';

  return (
    <>
      {/* Page header */}
      <div className="bg-ts-charcoal py-16 text-center">
        <FadeIn immediate className="mx-auto max-w-2xl space-y-3 px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.5em] text-ts-gold">
            Tredici Social
          </p>
          <h1 className="font-heading text-5xl font-medium text-white">Private Events</h1>
          <p className="text-sm text-ts-light-text/70">
            Host your most memorable occasions in the warm, social atmosphere of Tredici Social.
          </p>
        </FadeIn>
      </div>

      <main className="bg-ts-cream">
        {/* Why host here */}
        <section className="mx-auto max-w-7xl px-6 py-16">
          <FadeIn className="grid gap-12 lg:grid-cols-2" delayStep={0.15}>
            <div className="space-y-6">
              <SectionTitle
                eyebrow="Host Your Event"
                title="An evening worth celebrating"
                description="From intimate anniversary dinners to full restaurant buyouts, Tredici Social offers tailored private dining experiences backed by our full kitchen and hospitality team."
              />
              <ul className="space-y-3">
                {[
                  'Custom menus crafted with your occasion in mind',
                  'Dedicated event coordinator from inquiry to close',
                  'Full wine pairing and cocktail program available',
                  'AV capabilities and ambient music coordination',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-ts-dark-text">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ts-crimson/10 text-ts-crimson">
                      <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Capacity options */}
            <div className="grid gap-4 sm:grid-cols-1">
              {CAPACITY_INFO.map((opt) => (
                <Card key={opt.label} className="flex gap-4 p-5 sm:p-6">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ts-crimson/10 text-ts-crimson">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M9 20H4v-2a3 3 0 015.356-1.857M15 7a3 3 0 11-6 0 3 3 0 016 0zM21 14a5 5 0 00-9.9-1" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-heading text-lg font-medium text-ts-charcoal">{opt.label}</p>
                    <p className="mt-0.5 text-sm text-ts-muted">{opt.detail}</p>
                  </div>
                </Card>
              ))}
            </div>
          </FadeIn>
        </section>

        {/* Inquiry form */}
        <section className="bg-ts-linen py-16">
          <div className="mx-auto max-w-2xl px-6">
            <FadeIn className="space-y-8" delayStep={0.12}>
              <SectionTitle
                eyebrow="Inquire"
                title="Start planning your event"
                description="Tell us about your occasion and we'll be in touch within 24 hours."
                align="center"
              />

              {status === 'success' ? (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-8 text-center">
                  <p className="font-heading text-2xl font-medium text-emerald-800">Inquiry received!</p>
                  <p className="mt-2 text-sm text-emerald-700">
                    Thank you for reaching out. A member of our team will follow up within 24 hours to discuss your event.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  {/* Name + Email */}
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="name" className={labelClass}>Name *</label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        required
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Your full name"
                        className={inputClass}
                        autoComplete="name"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className={labelClass}>Email *</label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        value={form.email}
                        onChange={handleChange}
                        placeholder="you@example.com"
                        className={inputClass}
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label htmlFor="phone" className={labelClass}>Phone</label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="(914) 555-0000"
                      className={inputClass}
                      autoComplete="tel"
                    />
                  </div>

                  {/* Date + Time + Party Size */}
                  <div className="grid gap-5 sm:grid-cols-3">
                    <div>
                      <label htmlFor="date" className={labelClass}>Preferred Date *</label>
                      <input
                        id="date"
                        name="date"
                        type="date"
                        required
                        value={form.date}
                        onChange={handleChange}
                        min={new Date().toISOString().split('T')[0]}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label htmlFor="time" className={labelClass}>Preferred Time</label>
                      <input
                        id="time"
                        name="time"
                        type="time"
                        value={form.time}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label htmlFor="party_size" className={labelClass}>Party Size *</label>
                      <input
                        id="party_size"
                        name="party_size"
                        type="number"
                        required
                        min="8"
                        max="60"
                        value={form.party_size}
                        onChange={handleChange}
                        placeholder="e.g. 20"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {/* Event Type */}
                  <div>
                    <label htmlFor="event_type" className={labelClass}>Event Type *</label>
                    <select
                      id="event_type"
                      name="event_type"
                      required
                      value={form.event_type}
                      onChange={handleChange}
                      className={inputClass}
                    >
                      <option value="">Select an event type…</option>
                      {EVENT_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  {/* Message */}
                  <div>
                    <label htmlFor="message" className={labelClass}>Tell us about your event</label>
                    <textarea
                      id="message"
                      name="message"
                      rows={4}
                      value={form.message}
                      onChange={handleChange}
                      placeholder="Any details about your vision, dietary needs, budget, or special requests…"
                      className={`${inputClass} resize-none`}
                    />
                  </div>

                  {status === 'error' && (
                    <p className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                      {errorMsg}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="w-full rounded-full bg-ts-crimson py-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-white shadow-crimson transition hover:bg-ts-garnet focus:outline-none focus-visible:ring-2 focus-visible:ring-ts-crimson focus-visible:ring-offset-2 disabled:opacity-60"
                  >
                    {status === 'loading' ? 'Sending…' : 'Send Inquiry'}
                  </button>

                  <p className="text-center text-[11px] text-ts-muted">
                    Or call us directly at{' '}
                    <a href="tel:+19145550013" className="text-ts-crimson underline-offset-2 hover:underline">
                      (914) 555-0013
                    </a>
                  </p>
                </form>
              )}
            </FadeIn>
          </div>
        </section>
      </main>
    </>
  );
}
