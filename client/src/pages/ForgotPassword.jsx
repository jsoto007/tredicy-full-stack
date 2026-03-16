import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import { apiPost } from '../lib/api.js';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);
    setError(null);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await apiPost('/api/auth/forgot-password', { email: normalizedEmail });

      if (response?.status === 'verify_email') {
        setNotice('Verify your email to continue. We sent you a code to confirm your address.');
        navigate(`/verify-email?email=${encodeURIComponent(normalizedEmail)}`);
        return;
      }

      setNotice('Check your email for a verification code to reset your password.');
      navigate(`/reset-password?email=${encodeURIComponent(normalizedEmail)}`);
    } catch (err) {
      setError(err?.body?.error || 'Unable to start the reset right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="bg-white py-16 text-gray-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6">
        <SectionTitle
          eyebrow="Security"
          title="Reset your password"
          description="Enter the email on your account and we'll send a short verification code."
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
            <label className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-[0.3em] text-gray-500">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-black"
                placeholder="you@example.com"
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send code'}
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
