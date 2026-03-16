import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { apiPost } from '../lib/api.js';

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPassword() {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [searchParams] = useSearchParams();
  const initialEmail = useMemo(() => searchParams.get('email') || '', [searchParams]);
  const initialCode = useMemo(() => searchParams.get('code') || '', [searchParams]);

  const [form, setForm] = useState({
    email: initialEmail,
    code: initialCode,
    new_password: '',
    confirm_password: ''
  });
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setNotice(null);
    setError(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);
    setError(null);

    if (form.new_password !== form.confirm_password) {
      setError('New password and confirmation must match.');
      setSubmitting(false);
      return;
    }
    if (form.new_password.trim().length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        email: form.email.trim().toLowerCase(),
        code: form.code.trim(),
        new_password: form.new_password
      };
      await apiPost('/api/auth/forgot-password/confirm', payload);
      setNotice('Password updated. Redirecting to your dashboard…');
      await refreshSession();
      navigate('/portal/dashboard', { replace: true });
    } catch (err) {
      const message = err?.body?.error || 'Unable to update your password right now.';
      const needsVerification =
        err?.body?.error && err.body.error.toLowerCase().includes('verification code');
      setError(
        needsVerification
          ? 'Invalid or expired reset code. Verify your email first, then request a new code.'
          : message
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="bg-white py-16 text-gray-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6">
        <SectionTitle
          eyebrow="Security"
          title="Enter your reset code"
          description="Use the verification code we emailed you to choose a new password."
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
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-[0.3em] text-gray-500">New password</span>
                <input
                  type="password"
                  value={form.new_password}
                  onChange={handleChange('new_password')}
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-black"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-[0.3em] text-gray-500">Confirm password</span>
                <input
                  type="password"
                  value={form.confirm_password}
                  onChange={handleChange('confirm_password')}
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-black"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Updating…' : 'Update password'}
              </Button>
              <Link to="/forgot-password" className="text-xs uppercase tracking-[0.3em] text-gray-500 hover:text-black">
                Resend code
              </Link>
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
