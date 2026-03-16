import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { apiPost } from '../lib/api.js';

export default function ActivateAccount() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [token, setToken] = useState(searchParams.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (searchParams.get('token')) {
      setToken(searchParams.get('token'));
    }
  }, [searchParams]);

  const statusStyle = useMemo(() => {
    if (!status) {
      return '';
    }
    return status.tone === 'error'
      ? 'border-rose-400 bg-rose-50 text-rose-700'
      : 'border-emerald-400 bg-emerald-50 text-emerald-800';
  }, [status]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!token.trim()) {
      setStatus({ tone: 'error', message: 'Activation token is required.' });
      return;
    }
    if (password.length < 8) {
      setStatus({ tone: 'error', message: 'Password must be at least 8 characters.' });
      return;
    }
    if (password !== confirmPassword) {
      setStatus({ tone: 'error', message: 'Passwords do not match.' });
      return;
    }
    setSubmitting(true);
    setStatus(null);
    try {
      await apiPost('/api/auth/activate', { token: token.trim(), password });
      setStatus({ tone: 'success', message: 'Account activated. Redirecting to your dashboard...' });
      await refreshSession();
      navigate('/portal/dashboard', { replace: true });
    } catch (err) {
      const message = err.body?.error || 'Unable to activate your account right now.';
      setStatus({ tone: 'error', message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="bg-white py-16 text-gray-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6">
        <SectionTitle
          eyebrow="Account"
          title="Activate your BLACK INK TATTOO portal"
          description="Enter the token we emailed you and choose a secure password to start managing your bookings."
        />
        {status ? (
          <div className={`rounded-2xl border px-6 py-4 text-xs uppercase tracking-[0.3em] ${statusStyle}`}>
            {status.message}
          </div>
        ) : null}
        <Card className="space-y-6">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="activation-token" className="text-xs uppercase tracking-[0.3em] text-gray-500">
                Activation token
              </label>
              <input
                id="activation-token"
                type="text"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Paste the token from your email"
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
                required
              />
            </div>
            <div>
              <label htmlFor="activation-password" className="text-xs uppercase tracking-[0.3em] text-gray-500">
                New password
              </label>
              <input
                id="activation-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
                minLength={8}
                required
              />
            </div>
            <div>
              <label htmlFor="activation-password-confirm" className="text-xs uppercase tracking-[0.3em] text-gray-500">
                Confirm password
              </label>
              <input
                id="activation-password-confirm"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
                minLength={8}
                required
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Activating...' : 'Activate account'}
            </Button>
          </form>
          <p className="text-[0.7rem] uppercase tracking-[0.35em] text-gray-500">
            Already signed in?{' '}
            <Link to="/portal/dashboard" className="font-semibold underline">
              Go to dashboard
            </Link>
          </p>
          <p className="text-[0.7rem] uppercase tracking-[0.35em] text-gray-500">
            Need a new activation link?{' '}
            <Link to="/auth" className="font-semibold text-gray-900 underline">
              Request one from the auth page
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
}
