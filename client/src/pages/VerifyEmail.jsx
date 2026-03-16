import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { apiPost } from '../lib/api.js';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [searchParams] = useSearchParams();
  const initialEmail = useMemo(() => searchParams.get('email') || '', [searchParams]);
  const initialCode = useMemo(() => searchParams.get('code') || '', [searchParams]);

  const [form, setForm] = useState({
    email: initialEmail,
    code: initialCode
  });
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setNotice(null);
    setError(null);
  };

  const handleRequestCode = async () => {
    setSending(true);
    setNotice(null);
    setError(null);
    try {
      const response = await apiPost('/api/auth/email/verify-request', { email: form.email.trim().toLowerCase() });
      setNotice(response?.status === 'already_verified' ? 'Email is already verified.' : 'Verification email sent. Check your inbox for the code.');
    } catch (err) {
      setError(err?.body?.error || 'Unable to send verification right now.');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);
    setError(null);
    try {
      const payload = {
        email: form.email.trim().toLowerCase(),
        code: form.code.trim()
      };
      await apiPost('/api/auth/email/verify', payload);
      setNotice('Email verified. Redirecting…');
      await refreshSession();
      navigate('/portal/dashboard', { replace: true });
    } catch (err) {
      setError(err?.body?.error || 'Verification failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="bg-white py-16 text-gray-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6">
        <SectionTitle
          eyebrow="Security"
          title="Verify your email"
          description="Enter the code we sent to confirm your account and unlock password resets."
        />
        <Card className="space-y-6">
          {notice ? (
            <div className="rounded-2xl border border-emerald-500 bg-emerald-50 px-4 py-3 text-xs uppercase tracking-[0.3em] text-emerald-700">
              {notice}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-2xl border border-rose-500 bg-rose-50 px-4 py-3 text-xs uppercase tracking-[0.3em] text-rose-700">
              {error}
            </div>
          ) : null}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-[0.3em] text-gray-500">Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={handleChange('email')}
                  required
                  className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-black"
                  placeholder="you@example.com"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-[0.3em] text-gray-500">Verification code</span>
                <input
                  type="text"
                  value={form.code}
                  onChange={handleChange('code')}
                  required
                  className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-black"
                  placeholder="6-digit code"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Verifying…' : 'Verify email'}
              </Button>
              <Button type="button" variant="ghost" onClick={handleRequestCode} disabled={sending || !form.email}>
                {sending ? 'Sending…' : 'Resend code'}
              </Button>
              <Link to="/auth" className="text-xs uppercase tracking-[0.3em] text-gray-500 hover:text-black">
                Back to sign in
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}
