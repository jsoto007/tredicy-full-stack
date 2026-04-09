import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import FadeIn from '../components/FadeIn.jsx';
import Button from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import { apiGet, apiPost } from '../lib/api.js';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/heic', 'image/heif']);

function formatCurrency(amountCents, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format((amountCents || 0) / 100);
}

function formatDuration(minutes) {
  if (!minutes) return 'TBD';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (remainder) parts.push(`${remainder}m`);
  return parts.join(' ') || '0m';
}

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read image.'));
    reader.readAsDataURL(file);
  });
}

const inputClasses =
  'w-full rounded-xl border border-[#d9cbbc] bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#2a3923] focus:ring-2 focus:ring-[#2a3923]/10 placeholder:text-slate-400';

function StepBadge({ number, label, active, done }) {
  return (
    <div className={`flex items-center gap-2 ${active ? 'opacity-100' : done ? 'opacity-70' : 'opacity-40'}`}>
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
        done || active ? 'bg-[#2a3923] text-white' : 'border-2 border-[#d9cbbc] text-[#6f7863]'
      }`}>
        {done ? (
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : number}
      </div>
      <span className={`hidden text-xs font-semibold uppercase tracking-[0.2em] sm:block ${active ? 'text-[#2a3923]' : 'text-[#6f7863]'}`}>{label}</span>
    </div>
  );
}

function SectionHeader({ number, title }) {
  return (
    <div className="flex items-center gap-3 border-b border-[#ede5d8] pb-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2a3923] text-sm font-bold text-white">
        {number}
      </div>
      <h2 className="font-serif text-lg text-[#2a3923]">{title}</h2>
    </div>
  );
}

function Field({ label, error, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-[#2a3923]">{label}</label>
      {children}
      {hint && !error ? <p className="text-xs text-[#6f7863]">{hint}</p> : null}
      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#ede5d8] pb-3 last:border-0 last:pb-0">
      <span className="text-xs text-[#6f7863]">{label}</span>
      <span className="text-right text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function groupByCategory(products) {
  const map = new Map();
  for (const p of products) {
    const cat = p.category || 'Otros';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat).push(p);
  }
  return map;
}

function ServiceCategoryGroups({ products, selectedId, currency, onSelect }) {
  const groups = useMemo(() => groupByCategory(products), [products]);
  return (
    <div className="space-y-6">
      {Array.from(groups.entries()).map(([category, items]) => (
        <div key={category} className="space-y-3">
          <div className="flex items-center gap-3">
            <p className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.35em] text-[#6f7863]">
              {category}
            </p>
            <div className="h-px flex-1 bg-[#ede5d8]" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((product) => {
              const selected = String(product.id) === String(selectedId);
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onSelect(product.id)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selected
                      ? 'border-[#2a3923] bg-[#2a3923] text-white shadow-md'
                      : 'border-[#d9cbbc] bg-white hover:border-[#2a3923] hover:shadow-sm'
                  }`}
                >
                  {product.tagline ? (
                    <p className={`mb-1 text-[10px] font-semibold uppercase tracking-[0.3em] ${selected ? 'text-white/70' : 'text-[#8d755a]'}`}>
                      {product.tagline}
                    </p>
                  ) : null}
                  <p className={`font-semibold ${selected ? 'text-white' : 'text-slate-900'}`}>
                    {product.name || `Servicio ${product.id}`}
                  </p>
                  {product.description ? (
                    <p className={`mt-1 text-xs leading-relaxed ${selected ? 'text-white/75' : 'text-[#6f7863]'}`}>
                      {product.description}
                    </p>
                  ) : null}
                  <div className={`mt-2 flex items-center gap-2 text-xs ${selected ? 'text-white/80' : 'text-[#6f7863]'}`}>
                    <span>{formatDuration(product.duration_minutes)}</span>
                    <span>·</span>
                    <span className="font-semibold">{formatCurrency(product.price_cents, currency)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ShareYourIdea() {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);

  const stripePromise = useMemo(() => {
    return paymentConfig?.publishable_key ? loadStripe(paymentConfig.publishable_key) : null;
  }, [paymentConfig?.publishable_key]);
  const [availability, setAvailability] = useState([]);
  const [availabilityMeta, setAvailabilityMeta] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pageError, setPageError] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [notice, setNotice] = useState(
    searchParams.get('payment') === 'cancelled'
      ? 'Payment was cancelled. Your slot was not secured yet.'
      : ''
  );
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    session_option_id: '',
    notes: '',
    selected_date: toDateInputValue(new Date()),
    scheduled_start: '',
    pay_full_amount: false,
  });
  const [inspoFile, setInspoFile] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([apiGet('/api/pricing/session-options'), apiGet('/api/payments/config')])
      .then(([productPayload, paymentPayload]) => {
        if (!active) return;
        setProducts(Array.isArray(productPayload) ? productPayload : []);
        setPaymentConfig(paymentPayload?.stripe || null);
      })
      .catch((error) => {
        if (!active) return;
        setPageError(error.message || 'Unable to load booking information.');
      });
    return () => { active = false; };
  }, []);

  const selectedProduct = useMemo(
    () => products.find((p) => String(p.id) === String(form.session_option_id)) || null,
    [products, form.session_option_id]
  );

  useEffect(() => {
    if (!form.selected_date || !selectedProduct?.id) {
      setAvailability([]);
      setAvailabilityMeta(null);
      return;
    }
    let active = true;
    setLoadingSlots(true);
    setForm((c) => ({ ...c, scheduled_start: '' }));
    apiGet(`/api/availability?date=${encodeURIComponent(form.selected_date)}&session_option_id=${encodeURIComponent(selectedProduct.id)}`)
      .then((payload) => {
        if (!active) return;
        setAvailability(Array.isArray(payload?.slots) ? payload.slots : []);
        setAvailabilityMeta(payload || null);
      })
      .catch((error) => {
        if (!active) return;
        setAvailability([]);
        setAvailabilityMeta(null);
        setPageError(error.message || 'Unable to load available times.');
      })
      .finally(() => { if (active) setLoadingSlots(false); });
    return () => { active = false; };
  }, [form.selected_date, selectedProduct?.id]);

  const pricing = useMemo(() => {
    const totalCents = selectedProduct?.price_cents || 0;
    const bookingFeePercent = paymentConfig?.booking_fee_percent || 20;
    const depositCents = totalCents
      ? Math.min(totalCents, Math.max(1, Math.ceil((totalCents * bookingFeePercent) / 100)))
      : 0;
    return {
      currency: paymentConfig?.currency || 'USD',
      totalCents,
      depositCents,
      bookingFeePercent,
      amountDueToday: form.pay_full_amount ? totalCents : depositCents,
    };
  }, [paymentConfig, selectedProduct, form.pay_full_amount]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((c) => ({ ...c, [name]: value }));
    setFormErrors((c) => ({ ...c, [name]: '' }));
    setPageError('');
    setNotice('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setFormErrors((c) => ({ ...c, inspiration: '' }));
    if (!file) { setInspoFile(null); return; }
    if (!ACCEPTED_TYPES.has(file.type)) {
      setFormErrors((c) => ({ ...c, inspiration: 'Upload a JPG, PNG, WEBP, HEIC, or HEIF image.' }));
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFormErrors((c) => ({ ...c, inspiration: 'Image must be smaller than 8 MB.' }));
      return;
    }
    setInspoFile(file);
  };

  const validate = () => {
    const e = {};
    if (!form.first_name.trim()) e.first_name = 'First name is required.';
    if (!form.last_name.trim()) e.last_name = 'Last name is required.';
    if (!form.email.trim()) e.email = 'Email is required.';
    if (!form.phone.trim()) e.phone = 'Phone is required.';
    if (!form.session_option_id) e.session_option_id = 'Choose a service.';
    if (!form.selected_date) e.selected_date = 'Choose a date.';
    if (!form.scheduled_start) e.scheduled_start = 'Choose a time slot.';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      setTimeout(() => {
        const firstErrorField = Object.keys(errors)[0];
        let element = document.querySelector(`[name="${firstErrorField}"]`);
        if (!element && firstErrorField === 'session_option_id') {
          element = document.getElementById('service-selection-section');
        } else if (!element && firstErrorField === 'scheduled_start') {
          element = document.getElementById('time-selection-section');
        }
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (typeof element.focus === 'function') element.focus({ preventScroll: true });
        }
      }, 50);
      return;
    }
    setSubmitting(true);
    setPageError('');
    try {
      const inspiration_urls = inspoFile ? [await readFileAsDataUrl(inspoFile)] : [];
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        session_option_id: Number(form.session_option_id),
        scheduled_start: form.scheduled_start,
        notes: form.notes.trim(),
        inspiration_urls,
        pay_full_amount: form.pay_full_amount,
      };
      const response = await apiPost('/api/payments/stripe/initiate', payload);
      if (response?.checkout_client_secret) {
        setClientSecret(response.checkout_client_secret);
        return;
      }
      setPageError('Unable to start checkout. Please try again.');
    } catch (error) {
      if (error.body?.errors?.length) {
        const fieldErrors = {};
        error.body.errors.forEach((entry) => { if (entry?.field) fieldErrors[entry.field] = entry.message; });
        setFormErrors(fieldErrors);
      }
      setPageError(error.message || 'Unable to book reservation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const step1Done = !!(form.first_name && form.last_name && form.email && form.phone);
  const step2Done = !!selectedProduct;
  const step3Done = !!form.scheduled_start;

  if (clientSecret && stripePromise) {
    return (
      <main className="min-h-screen bg-[#ECE7E2] py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <FadeIn className="text-center mb-10">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.4em] text-[#6f7863]">Secure Checkout</p>
            <h1 className="font-serif text-3xl text-[#2a3923] sm:text-4xl">Complete your booking</h1>
          </FadeIn>
          <Card className="p-0 overflow-hidden bg-white shadow-xl max-w-2xl mx-auto rounded-3xl min-h-[600px] relative">
            <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
              <EmbeddedCheckout className="py-8" />
            </EmbeddedCheckoutProvider>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#ECE7E2] py-12">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">

        {/* Header */}
        <FadeIn className="mb-10 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.4em] text-[#6f7863]">Book your visit</p>
          <h1 className="font-serif text-4xl text-[#2a3923] sm:text-5xl">Reserve your reservation</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#5e6755]">
            Fill in your details, choose a service and time, then pay a deposit or the full amount to secure your slot.
          </p>
        </FadeIn>

        {/* Step progress */}
        <FadeIn className="mb-8 flex items-center justify-center gap-3 sm:gap-6">
          <StepBadge number="1" label="Your info" active={!step1Done} done={step1Done} />
          <div className="h-px w-6 bg-[#d9cbbc] sm:w-10" />
          <StepBadge number="2" label="Service" active={step1Done && !step2Done} done={step2Done} />
          <div className="h-px w-6 bg-[#d9cbbc] sm:w-10" />
          <StepBadge number="3" label="Date & time" active={step2Done && !step3Done} done={step3Done} />
          <div className="h-px w-6 bg-[#d9cbbc] sm:w-10" />
          <StepBadge number="4" label="Payment" active={step3Done} done={false} />
        </FadeIn>

        {/* Alerts */}
        {notice ? (
          <FadeIn className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            {notice}
          </FadeIn>
        ) : null}
        {pageError ? (
          <FadeIn className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {pageError}
          </FadeIn>
        ) : null}

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 lg:grid-cols-[1fr_300px] lg:items-start">

            {/* Left column */}
            <div className="space-y-6">

              {/* 1 — Contact info */}
              <Card className="space-y-5 p-6 sm:p-8">
                <SectionHeader number="1" title="Your information" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="First name" error={formErrors.first_name}>
                    <input name="first_name" value={form.first_name} onChange={handleChange} placeholder="First name" className={inputClasses} />
                  </Field>
                  <Field label="Last name" error={formErrors.last_name}>
                    <input name="last_name" value={form.last_name} onChange={handleChange} placeholder="Last name" className={inputClasses} />
                  </Field>
                  <Field label="Email address" error={formErrors.email}>
                    <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@example.com" className={inputClasses} />
                  </Field>
                  <Field label="Phone number" error={formErrors.phone}>
                    <input name="phone" value={form.phone} onChange={handleChange} placeholder="(929) 000-0000" className={inputClasses} />
                  </Field>
                </div>
              </Card>

              {/* 2 — Service */}
              <Card id="service-selection-section" className="space-y-6 p-6 sm:p-8">
                <SectionHeader number="2" title="Elige un servicio" />
                {products.length === 0 ? (
                  <p className="text-sm text-[#6f7863]">Cargando servicios…</p>
                ) : (
                  <ServiceCategoryGroups
                    products={products}
                    selectedId={form.session_option_id}
                    currency={paymentConfig?.currency || 'USD'}
                    onSelect={(id) => {
                      setForm((c) => ({ ...c, session_option_id: String(id) }));
                      setFormErrors((c) => ({ ...c, session_option_id: '' }));
                    }}
                  />
                )}
                {formErrors.session_option_id ? (
                  <p className="text-xs font-medium text-red-600">{formErrors.session_option_id}</p>
                ) : null}
              </Card>

              {/* 3 — Date & time */}
              <Card id="time-selection-section" className="space-y-5 p-6 sm:p-8">
                <SectionHeader number="3" title="Date & time" />
                <Field label="Preferred date" error={formErrors.selected_date}>
                  <input
                    name="selected_date"
                    type="date"
                    min={toDateInputValue(new Date())}
                    value={form.selected_date}
                    onChange={handleChange}
                    className={inputClasses}
                  />
                </Field>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#2a3923]">Available times</p>
                    {loadingSlots ? (
                      <span className="flex items-center gap-1.5 text-xs text-[#6f7863]">
                        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        Loading…
                      </span>
                    ) : null}
                  </div>

                  {!selectedProduct ? (
                    <p className="rounded-xl border border-dashed border-[#d9cbbc] bg-white/60 py-6 text-center text-sm text-[#6f7863]">
                      Select a service above to see available times
                    </p>
                  ) : !loadingSlots && !availability.length ? (
                    <p className="rounded-xl border border-dashed border-[#d9cbbc] bg-white/60 py-6 text-center text-sm text-[#6f7863]">
                      {availabilityMeta?.is_closed
                        ? 'The studio is closed on this date.'
                        : 'No times available — try a different date.'}
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {availability.map((slot) => {
                        const selected = form.scheduled_start === slot.start;
                        const label = new Date(slot.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                        return (
                          <button
                            key={slot.start}
                            type="button"
                            onClick={() => {
                              setForm((c) => ({ ...c, scheduled_start: slot.start }));
                              setFormErrors((c) => ({ ...c, scheduled_start: '' }));
                            }}
                            className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                              selected
                                ? 'border-[#2a3923] bg-[#2a3923] text-white shadow-sm'
                                : 'border-[#d9cbbc] bg-white text-slate-900 hover:border-[#2a3923]'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {formErrors.scheduled_start ? (
                    <p className="text-xs font-medium text-red-600">{formErrors.scheduled_start}</p>
                  ) : null}
                </div>
              </Card>

              {/* 4 — Notes + inspo */}
              <Card className="space-y-5 p-6 sm:p-8">
                <SectionHeader number="4" title={<>Extras <span className="font-bold">(optional)</span></>} />
                <Field label="Notes for your nail tech" hint="Anything you'd like them to know before the visit.">
                  <textarea
                    name="notes"
                    rows="4"
                    value={form.notes}
                    onChange={handleChange}
                    placeholder="e.g. I want a minimalist look, short nails…"
                    className={inputClasses}
                  />
                </Field>
                <Field label="Inspiration image" error={formErrors.inspiration} hint="JPG, PNG, WEBP, HEIC — max 8 MB.">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="block w-full cursor-pointer rounded-xl border border-dashed border-[#d9cbbc] bg-white px-4 py-5 text-sm text-[#6f7863] transition file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#2a3923] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:uppercase file:tracking-wide file:text-white hover:border-[#2a3923]"
                  />
                  {inspoFile ? <p className="mt-1.5 text-xs text-[#6f7863]">✓ {inspoFile.name}</p> : null}
                </Field>
              </Card>

              {/* 5 — Payment */}
              <Card className="space-y-5 p-6 sm:p-8">
                <SectionHeader number="5" title="Payment" />
                <div className="space-y-3">
                  <label className={`flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition ${
                    !form.pay_full_amount ? 'border-[#2a3923] bg-[#2a3923]/5' : 'border-[#d9cbbc] bg-white hover:border-[#2a3923]'
                  }`}>
                    <input
                      type="radio"
                      name="payment_choice"
                      checked={!form.pay_full_amount}
                      onChange={() => setForm((c) => ({ ...c, pay_full_amount: false }))}
                      className="mt-0.5 accent-[#2a3923]"
                    />
                    <div>
                      <p className="font-semibold text-slate-900">
                        Pay deposit — {selectedProduct ? formatCurrency(pricing.depositCents, pricing.currency) : '—'}
                      </p>
                      <p className="mt-0.5 text-sm text-[#6f7863]">
                        Secure your slot with a {pricing.bookingFeePercent}% deposit. Pay the rest at the studio.
                      </p>
                    </div>
                  </label>
                  <label className={`flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition ${
                    form.pay_full_amount ? 'border-[#2a3923] bg-[#2a3923]/5' : 'border-[#d9cbbc] bg-white hover:border-[#2a3923]'
                  }`}>
                    <input
                      type="radio"
                      name="payment_choice"
                      checked={form.pay_full_amount}
                      onChange={() => setForm((c) => ({ ...c, pay_full_amount: true }))}
                      className="mt-0.5 accent-[#2a3923]"
                    />
                    <div>
                      <p className="font-semibold text-slate-900">
                        Pay in full — {selectedProduct ? formatCurrency(pricing.totalCents, pricing.currency) : '—'}
                      </p>
                      <p className="mt-0.5 text-sm text-[#6f7863]">
                        Complete payment now via Stripe. Nothing more to pay at the studio.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="flex flex-col gap-4 border-t border-[#ede5d8] pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-[#6f7863]">No account required. Payment processed securely by Stripe.</p>
                  <Button type="submit" disabled={submitting || !selectedProduct} className="w-full sm:w-auto">
                    {submitting
                      ? 'Processing…'
                      : selectedProduct
                        ? `Continue to payment · ${formatCurrency(pricing.amountDueToday, pricing.currency)}`
                        : 'Continue to payment'}
                  </Button>
                </div>
              </Card>
            </div>

            {/* Sticky sidebar */}
            <div className="lg:sticky lg:top-24">
              <Card className="space-y-5 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#6f7863]">Booking summary</p>
                <div className="space-y-3">
                  <SummaryRow label="Service" value={selectedProduct?.name || 'Not selected'} />
                  <SummaryRow
                    label="Duration"
                    value={selectedProduct ? formatDuration(selectedProduct.duration_minutes) : '—'}
                  />
                  <SummaryRow
                    label="Date"
                    value={form.selected_date
                      ? new Date(form.selected_date + 'T00:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
                      : '—'}
                  />
                  <SummaryRow
                    label="Time"
                    value={form.scheduled_start
                      ? new Date(form.scheduled_start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                      : '—'}
                  />
                </div>

                {selectedProduct ? (
                  <div className="space-y-2 rounded-2xl bg-[#f5f0ea] p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#6f7863]">Total</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(pricing.totalCents, pricing.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-[#6f7863]">Due today</span>
                      <span className="text-lg font-bold text-[#2a3923]">{formatCurrency(pricing.amountDueToday, pricing.currency)}</span>
                    </div>
                    {!form.pay_full_amount && pricing.totalCents > pricing.depositCents ? (
                      <p className="pt-1 text-xs text-[#6f7863]">
                        Remaining {formatCurrency(pricing.totalCents - pricing.depositCents, pricing.currency)} paid at studio.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-[#f5f0ea] p-4 text-center text-xs text-[#6f7863]">
                    Select a service to see pricing
                  </div>
                )}

                <div className="space-y-2 text-xs text-[#6f7863]">
                  <div className="flex items-center gap-2">
                    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    Payments secured by Stripe
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                    Confirmation sent by email
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
