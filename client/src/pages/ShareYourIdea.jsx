import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import FadeIn from '../components/FadeIn.jsx';
import Button from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import { apiGet, apiPost } from '../lib/api.js';

const BOOKING_RECEIPT_KEY = 'melodi-nails:last-booking';
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/heic', 'image/heif']);

function formatCurrency(amountCents, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format((amountCents || 0) / 100);
}

function formatDuration(minutes) {
  if (!minutes) {
    return 'Duration set by admin';
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  const parts = [];
  if (hours) {
    parts.push(`${hours}h`);
  }
  if (remainder) {
    parts.push(`${remainder}m`);
  }
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

function storeLatestAppointment(appointment) {
  if (!appointment) {
    return;
  }
  try {
    sessionStorage.setItem(BOOKING_RECEIPT_KEY, JSON.stringify({ appointment, savedAt: Date.now() }));
  } catch {
    // Ignore storage failures.
  }
}

export default function ShareYourIdea() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [availabilityMeta, setAvailabilityMeta] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pageError, setPageError] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [successNotice, setSuccessNotice] = useState(
    searchParams.get('payment') === 'cancelled'
      ? 'Payment was cancelled. Your selected slot was not fully secured yet.'
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
    pay_full_amount: false
  });
  const [inspoFile, setInspoFile] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([apiGet('/api/pricing/session-options'), apiGet('/api/payments/config')])
      .then(([productPayload, paymentPayload]) => {
        if (!active) {
          return;
        }
        setProducts(Array.isArray(productPayload) ? productPayload : []);
        setPaymentConfig(paymentPayload?.stripe || null);
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setPageError(error.message || 'Unable to load booking information.');
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedProduct = useMemo(
    () => products.find((entry) => String(entry.id) === String(form.session_option_id)) || null,
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
    setForm((current) => ({ ...current, scheduled_start: '' }));
    apiGet(
      `/api/availability?date=${encodeURIComponent(form.selected_date)}&session_option_id=${encodeURIComponent(
        selectedProduct.id
      )}`
    )
      .then((payload) => {
        if (!active) {
          return;
        }
        setAvailability(Array.isArray(payload?.slots) ? payload.slots : []);
        setAvailabilityMeta(payload || null);
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setAvailability([]);
        setAvailabilityMeta(null);
        setPageError(error.message || 'Unable to load appointments for that day.');
      })
      .finally(() => {
        if (active) {
          setLoadingSlots(false);
        }
      });

    return () => {
      active = false;
    };
  }, [form.selected_date, selectedProduct?.id]);

  const pricing = useMemo(() => {
    const totalCents = selectedProduct?.price_cents || 0;
    const bookingFeePercent = paymentConfig?.booking_fee_percent || 20;
    const depositCents = totalCents ? Math.min(totalCents, Math.max(1, Math.ceil((totalCents * bookingFeePercent) / 100))) : 0;
    return {
      currency: paymentConfig?.currency || 'USD',
      totalCents,
      depositCents,
      bookingFeePercent,
      amountDueToday: form.pay_full_amount ? totalCents : depositCents
    };
  }, [paymentConfig, selectedProduct, form.pay_full_amount]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFormErrors((current) => ({ ...current, [name]: '' }));
    setPageError('');
    setSuccessNotice('');
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setFormErrors((current) => ({ ...current, inspiration: '' }));
    if (!file) {
      setInspoFile(null);
      return;
    }
    if (!ACCEPTED_TYPES.has(file.type)) {
      setFormErrors((current) => ({ ...current, inspiration: 'Upload a JPG, PNG, WEBP, HEIC, or HEIF image.' }));
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFormErrors((current) => ({ ...current, inspiration: 'Image must be smaller than 8MB.' }));
      return;
    }
    setInspoFile(file);
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.first_name.trim()) nextErrors.first_name = 'First name is required.';
    if (!form.last_name.trim()) nextErrors.last_name = 'Last name is required.';
    if (!form.email.trim()) nextErrors.email = 'Email is required.';
    if (!form.phone.trim()) nextErrors.phone = 'Phone number is required.';
    if (!form.session_option_id) nextErrors.session_option_id = 'Choose a service.';
    if (!form.selected_date) nextErrors.selected_date = 'Choose a date.';
    if (!form.scheduled_start) nextErrors.scheduled_start = 'Choose an available time.';
    return nextErrors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setFormErrors(nextErrors);
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
        pay_full_amount: form.pay_full_amount
      };
      const response = await apiPost('/api/appointments', payload);
      const appointment = response?.appointment || null;
      if (appointment) {
        storeLatestAppointment(appointment);
      }
      if (response?.requires_payment && response?.checkout_url) {
        window.location.assign(response.checkout_url);
        return;
      }
      navigate('/booking/confirmation', {
        state: { appointment }
      });
    } catch (error) {
      if (error.body?.errors?.length) {
        const nextFieldErrors = {};
        error.body.errors.forEach((entry) => {
          if (entry?.field) {
            nextFieldErrors[entry.field] = entry.message;
          }
        });
        setFormErrors(nextFieldErrors);
      }
      setPageError(error.message || 'Unable to book appointment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#ECE7E2] py-12 text-[#23301d]">
      <div className="mx-auto max-w-5xl px-4">
        <FadeIn>
          <SectionTitle
            eyebrow="Book Nails"
            title="Reserve your appointment"
            description="Choose a service, pick an available time, add optional notes or inspiration, and pay either the deposit or the full amount."
          />
        </FadeIn>

        {successNotice ? (
          <FadeIn>
            <Card className="mt-6 border border-amber-200 bg-amber-50 text-sm text-amber-900">
              {successNotice}
            </Card>
          </FadeIn>
        ) : null}

        {pageError ? (
          <FadeIn>
            <Card className="mt-6 border border-red-200 bg-red-50 text-sm text-red-700">
              {pageError}
            </Card>
          </FadeIn>
        ) : null}

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.5fr_0.9fr]">
          <FadeIn>
            <Card className="p-6 sm:p-8">
              <form className="space-y-8" onSubmit={handleSubmit}>
                {/* Contact info */}
                <section className="grid gap-4 sm:grid-cols-2">
                  <Field label="First name" error={formErrors.first_name}>
                    <input name="first_name" value={form.first_name} onChange={handleChange} className={inputClasses} />
                  </Field>
                  <Field label="Last name" error={formErrors.last_name}>
                    <input name="last_name" value={form.last_name} onChange={handleChange} className={inputClasses} />
                  </Field>
                  <Field label="Email" error={formErrors.email}>
                    <input name="email" type="email" value={form.email} onChange={handleChange} className={inputClasses} />
                  </Field>
                  <Field label="Phone number" error={formErrors.phone}>
                    <input name="phone" value={form.phone} onChange={handleChange} className={inputClasses} />
                  </Field>
                </section>

                {/* Service + date */}
                <section className="grid gap-4 sm:grid-cols-2">
                  <Field label="Service" error={formErrors.session_option_id}>
                    <select name="session_option_id" value={form.session_option_id} onChange={handleChange} className={inputClasses}>
                      <option value="">Select a service</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name || `Service ${product.id}`} · {formatDuration(product.duration_minutes)} ·{' '}
                          {formatCurrency(product.price_cents, paymentConfig?.currency || 'USD')}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Date" error={formErrors.selected_date}>
                    <input
                      name="selected_date"
                      type="date"
                      min={toDateInputValue(new Date())}
                      value={form.selected_date}
                      onChange={handleChange}
                      className={inputClasses}
                    />
                  </Field>
                </section>

                {/* Time slots */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#6f7863]">
                      Available times
                    </p>
                    {loadingSlots ? (
                      <span className="text-xs text-[#6f7863]">Loading…</span>
                    ) : null}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {availability.map((slot) => {
                      const selected = form.scheduled_start === slot.start;
                      const label = new Date(slot.start).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit'
                      });
                      return (
                        <button
                          key={slot.start}
                          type="button"
                          onClick={() => {
                            setForm((current) => ({ ...current, scheduled_start: slot.start }));
                            setFormErrors((current) => ({ ...current, scheduled_start: '' }));
                          }}
                          className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                            selected
                              ? 'border-[#2a3923] bg-[#2a3923] text-white'
                              : 'border-[#d9cbbc] bg-[#fffdf9] text-slate-900 hover:border-[#2a3923]'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  {!loadingSlots && !availability.length ? (
                    <p className="text-sm text-[#6f7863]">
                      {availabilityMeta?.is_closed
                        ? 'The studio is closed for that date.'
                        : 'No time slots are available for that date and service.'}
                    </p>
                  ) : null}
                  {formErrors.scheduled_start ? (
                    <p className="text-sm text-red-600">{formErrors.scheduled_start}</p>
                  ) : null}
                </section>

                {/* Notes + inspiration */}
                <section className="grid gap-4">
                  <Field label="Notes (optional)">
                    <textarea
                      name="notes"
                      rows="5"
                      value={form.notes}
                      onChange={handleChange}
                      className={inputClasses}
                      placeholder="Anything you want the nail tech to know before the appointment."
                    />
                  </Field>
                  <Field label="Inspiration image (optional)" error={formErrors.inspiration}>
                    <input type="file" accept="image/*" onChange={handleFileChange} className={inputClasses} />
                    {inspoFile ? (
                      <p className="mt-2 text-xs text-[#6f7863]">{inspoFile.name}</p>
                    ) : null}
                  </Field>
                </section>

                {/* Payment choice */}
                <section className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#6f7863]">
                    Payment today
                  </p>
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#d9cbbc] p-4 transition hover:border-[#2a3923]">
                    <input
                      type="radio"
                      name="payment_choice"
                      checked={!form.pay_full_amount}
                      onChange={() => setForm((current) => ({ ...current, pay_full_amount: false }))}
                    />
                    <span>
                      <span className="block font-semibold text-slate-900">
                        Pay deposit now: {formatCurrency(pricing.depositCents, pricing.currency)}
                      </span>
                      <span className="text-sm text-[#6f7863]">
                        The deposit percentage is set by the admin at {pricing.bookingFeePercent}%.
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#d9cbbc] p-4 transition hover:border-[#2a3923]">
                    <input
                      type="radio"
                      name="payment_choice"
                      checked={form.pay_full_amount}
                      onChange={() => setForm((current) => ({ ...current, pay_full_amount: true }))}
                    />
                    <span>
                      <span className="block font-semibold text-slate-900">
                        Pay full amount now: {formatCurrency(pricing.totalCents, pricing.currency)}
                      </span>
                      <span className="text-sm text-[#6f7863]">
                        Use Stripe Checkout to complete the booking securely.
                      </span>
                    </span>
                  </label>
                </section>

                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#d9cbbc] pt-6">
                  <p className="text-sm text-[#6f7863]">
                    No account is required. After you submit, Stripe will collect payment and return you to your confirmation page.
                  </p>
                  <Button type="submit" disabled={submitting || !selectedProduct}>
                    {submitting ? 'Processing…' : `Continue to Stripe · ${formatCurrency(pricing.amountDueToday, pricing.currency)}`}
                  </Button>
                </div>
              </form>
            </Card>
          </FadeIn>

          {/* Summary sidebar */}
          <FadeIn>
            <Card className="p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#6f7863]">
                Booking summary
              </p>
              <div className="mt-4 space-y-4">
                <SummaryRow label="Service" value={selectedProduct?.name || 'Choose a service'} />
                <SummaryRow label="Duration" value={selectedProduct ? formatDuration(selectedProduct.duration_minutes) : '—'} />
                <SummaryRow
                  label="Total price"
                  value={selectedProduct ? formatCurrency(pricing.totalCents, pricing.currency) : '—'}
                />
                <SummaryRow
                  label="Due today"
                  value={selectedProduct ? formatCurrency(pricing.amountDueToday, pricing.currency) : '—'}
                />
                <SummaryRow
                  label="Selected time"
                  value={
                    form.scheduled_start
                      ? new Date(form.scheduled_start).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })
                      : 'Choose a slot'
                  }
                />
              </div>
            </Card>
          </FadeIn>
        </div>
      </div>
    </main>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-[#2a3923]">{label}</span>
      {children}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </label>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#e8ddd0] pb-3 text-sm last:border-b-0">
      <span className="text-[#6f7863]">{label}</span>
      <span className="text-right font-semibold text-slate-900">{value}</span>
    </div>
  );
}

const inputClasses =
  'w-full rounded-2xl border border-[#d9cbbc] bg-[#fffdf9] px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#2a3923] focus:ring-1 focus:ring-[#2a3923]/20';
