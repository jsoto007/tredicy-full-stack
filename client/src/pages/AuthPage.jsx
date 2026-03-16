import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import SectionTitle from '../components/SectionTitle.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { apiPost } from '../lib/api.js';

const INITIAL_REGISTER = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  password: ''
};

const INITIAL_LOGIN = {
  email: '',
  password: ''
};

const REGISTER_FIELD_IDS = {
  firstName: 'register-first-name',
  lastName: 'register-last-name',
  email: 'register-email',
  phone: 'register-phone',
  password: 'register-password'
};

const LOGIN_FIELD_IDS = {
  email: 'login-email',
  password: 'login-password'
};

const AUTH_MODES = {
  register: 'register',
  login: 'login'
};

export default function AuthPage() {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [registerForm, setRegisterForm] = useState(INITIAL_REGISTER);
  const [loginForm, setLoginForm] = useState(INITIAL_LOGIN);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [activationEmail, setActivationEmail] = useState('');
  const [activationError, setActivationError] = useState(null);
  const [activationStatus, setActivationStatus] = useState(null);
  const [activationSubmitting, setActivationSubmitting] = useState(false);
  const [mode, setMode] = useState(AUTH_MODES.login);
  const registerFirstNameRef = useRef(null);
  const loginEmailRef = useRef(null);

  const isRegisterMode = mode === AUTH_MODES.register;

  const handleModeChange = (nextMode) => {
    if (nextMode === mode || submitting) {
      return;
    }
    setMode(nextMode);
    setNotice(null);
    setError(null);
  };

  useEffect(() => {
    if (isRegisterMode) {
      registerFirstNameRef.current?.focus();
    } else {
      loginEmailRef.current?.focus();
    }
  }, [isRegisterMode]);

  const heroTitle = isRegisterMode ? 'Create a Melodi Nails portal account' : 'Sign in to your Melodi Nails portal';
  const heroDescription = isRegisterMode
    ? 'Create a secure portal account to manage appointments, documents, and inspiration.'
    : 'View appointments, share inspiration, and manage your profile.';

  const handleRegisterChange = (field) => (event) => {
    setRegisterForm((prev) => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleLoginChange = (field) => (event) => {
    setLoginForm((prev) => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleRegisterSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);
    setError(null);

    try {
      const payload = {
        first_name: registerForm.first_name.trim(),
        last_name: registerForm.last_name.trim(),
        email: registerForm.email.trim().toLowerCase(),
        phone: registerForm.phone.trim() || null,
        password: registerForm.password
      };

      const response = await apiPost('/api/auth/register', payload);
      const redirect = response?.redirect_to || '/portal/dashboard';
      setRegisterForm(INITIAL_REGISTER);
      setLoginForm(INITIAL_LOGIN);
      setNotice('Account created – check your email for a verification code. Redirecting to your dashboard.');
      await refreshSession();
      navigate(redirect, { replace: true });
    } catch (err) {
      const serverMessage = err?.body?.errors?.[0]?.message;
      if (serverMessage) {
        const suggestion = serverMessage.includes('already exists')
          ? ' If you booked as a guest you can request an activation link below.'
          : '';
        setError(`${serverMessage}${suggestion}`);
      } else if (err.status === 400) {
        setError('Please review the highlighted fields and try again.');
      } else {
        setError('Unable to create your account right now.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivationRequest = async (event) => {
    event.preventDefault();
    const payloadEmail = (activationEmail || '').trim().toLowerCase();
    if (!payloadEmail) {
      setActivationError('Enter the email you used for your guest booking.');
      return;
    }
    setActivationSubmitting(true);
    setActivationError(null);
    setActivationStatus(null);
    try {
      await apiPost('/api/auth/activation-request', { email: payloadEmail });
      setActivationStatus('Check your inbox for the activation link.');
      setActivationEmail('');
    } catch (err) {
      const message = err.body?.error || 'Unable to send activation link right now.';
      setActivationError(message);
    } finally {
      setActivationSubmitting(false);
    }
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);
    setError(null);

    try {
      const payload = {
        email: loginForm.email.trim().toLowerCase(),
        password: loginForm.password
      };

      const response = await apiPost('/api/auth/login', payload);
      const redirect = response?.redirect_to;

      if (redirect) {
        setLoginForm(INITIAL_LOGIN);
        setNotice('Signed in successfully – redirecting.');
        await refreshSession();
        navigate(redirect, { replace: true });
        return;
      }

      setError('Unexpected response. Please try again.');
    } catch (err) {
      if (err.status === 401) {
        setError('Invalid email or password.');
      } else {
        setError('Unable to sign in right now.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="bg-white py-16 text-gray-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6">
        <SectionTitle eyebrow="Account" title={heroTitle} description={heroDescription} />
        {notice ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-6 py-4 text-xs uppercase tracking-[0.3em] text-gray-600">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-rose-500 bg-rose-50 px-6 py-4 text-xs uppercase tracking-[0.3em] text-rose-700">
            {error}
          </div>
        ) : null}
        <div className="mx-auto w-full max-w-2xl space-y-6">
          <div className="flex justify-center">
            <div className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 p-1 text-xs font-semibold uppercase tracking-[0.3em]">
              <button
                type="button"
                onClick={() => handleModeChange(AUTH_MODES.login)}
                disabled={submitting}
                className={`rounded-full px-4 py-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-60 ${
                  isRegisterMode
                    ? 'text-gray-600 hover:text-black'
                    : 'bg-black text-white shadow-soft'
                }`}
                aria-pressed={!isRegisterMode}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => handleModeChange(AUTH_MODES.register)}
                disabled={submitting}
                className={`rounded-full px-4 py-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-60 ${
                  isRegisterMode
                    ? 'bg-black text-white shadow-soft'
                    : 'text-gray-600 hover:text-black'
                }`}
                aria-pressed={isRegisterMode}
              >
                Create account
              </button>
            </div>
          </div>
          <Card className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500">
                {isRegisterMode ? 'Create an account' : 'Sign in'}
              </h2>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
                {isRegisterMode
                  ? 'Join the studio to manage bookings and share references.'
                  : 'Admins use the same form. We will send you to the right dashboard after authentication.'}
              </p>
            </div>
            {isRegisterMode ? (
              <form className="space-y-4" onSubmit={handleRegisterSubmit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor={REGISTER_FIELD_IDS.firstName}
                      className="text-xs uppercase tracking-[0.3em] text-gray-500"
                    >
                      First name
                    </label>
                    <input
                      id={REGISTER_FIELD_IDS.firstName}
                      ref={registerFirstNameRef}
                      type="text"
                      value={registerForm.first_name}
                      onChange={handleRegisterChange('first_name')}
                      className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={REGISTER_FIELD_IDS.lastName}
                      className="text-xs uppercase tracking-[0.3em] text-gray-500"
                    >
                      Last name
                    </label>
                    <input
                      id={REGISTER_FIELD_IDS.lastName}
                      type="text"
                      value={registerForm.last_name}
                      onChange={handleRegisterChange('last_name')}
                      className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor={REGISTER_FIELD_IDS.email}
                    className="text-xs uppercase tracking-[0.3em] text-gray-500"
                  >
                    Email
                  </label>
                  <input
                    id={REGISTER_FIELD_IDS.email}
                    type="email"
                    value={registerForm.email}
                    onChange={handleRegisterChange('email')}
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor={REGISTER_FIELD_IDS.phone}
                    className="text-xs uppercase tracking-[0.3em] text-gray-500"
                  >
                    Phone
                  </label>
                  <input
                    id={REGISTER_FIELD_IDS.phone}
                    type="tel"
                    value={registerForm.phone}
                    onChange={handleRegisterChange('phone')}
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
                  />
                </div>
                <div>
                  <label
                    htmlFor={REGISTER_FIELD_IDS.password}
                    className="text-xs uppercase tracking-[0.3em] text-gray-500"
                  >
                    Password
                  </label>
                  <input
                    id={REGISTER_FIELD_IDS.password}
                    type="password"
                    value={registerForm.password}
                    onChange={handleRegisterChange('password')}
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
                    required
                    minLength={8}
                  />
                </div>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create account'}
                </Button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={handleLoginSubmit}>
                <div>
                  <label
                    htmlFor={LOGIN_FIELD_IDS.email}
                    className="text-xs uppercase tracking-[0.3em] text-gray-500"
                  >
                    Email
                  </label>
                  <input
                    id={LOGIN_FIELD_IDS.email}
                    ref={loginEmailRef}
                    type="email"
                    value={loginForm.email}
                    onChange={handleLoginChange('email')}
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor={LOGIN_FIELD_IDS.password}
                    className="text-xs uppercase tracking-[0.3em] text-gray-500"
                  >
                    Password
                  </label>
                  <input
                    id={LOGIN_FIELD_IDS.password}
                    type="password"
                    value={loginForm.password}
                    onChange={handleLoginChange('password')}
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
                    required
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Signing in...' : 'Sign in'}
                  </Button>
                  <Link
                    to="/forgot-password"
                    className="text-xs uppercase tracking-[0.3em] text-gray-500 hover:text-black"
                  >
                    Forgot password?
                  </Link>
                </div>
              </form>
            )}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
            {isRegisterMode ? 'Already have an account?' : 'Need a studio account?'}
          </p>
          <button
            type="button"
            onClick={() => handleModeChange(isRegisterMode ? AUTH_MODES.login : AUTH_MODES.register)}
            disabled={submitting}
            className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-900 underline-offset-4 transition hover:underline disabled:opacity-60"
          >
            {isRegisterMode ? 'Switch to sign in' : 'Switch to create account'}
          </button>
        </div>
        {!isRegisterMode ? (
          <p className="text-[0.6rem] uppercase tracking-[0.35em] text-gray-500">
            Studio staff?{' '}
            <Link to="/dashboard/admin" className="font-semibold text-gray-900 underline">
              Go to the Admin Console
            </Link>
          </p>
        ) : null}
      </Card>
      <Card className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500">
            Activate an existing guest account
          </h2>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
            We will email a secure link so you can choose a password and start using the portal.
          </p>
        </div>
        <form className="space-y-3" onSubmit={handleActivationRequest}>
          <div>
            <label htmlFor="activation-email" className="text-xs uppercase tracking-[0.3em] text-gray-500">
              Email
            </label>
            <input
              id="activation-email"
              type="email"
              value={activationEmail}
              onChange={(event) => {
                setActivationEmail(event.target.value);
                setActivationError(null);
                setActivationStatus(null);
              }}
              placeholder="you@example.com"
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-0"
              required
            />
          </div>
          <Button type="submit" disabled={activationSubmitting}>
            {activationSubmitting ? 'Sending...' : 'Email activation link'}
          </Button>
        </form>
        {activationStatus ? (
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-600">
            {activationStatus}
          </p>
        ) : null}
        {activationError ? (
          <p className="text-xs uppercase tracking-[0.25em] text-rose-500">{activationError}</p>
        ) : null}
        <p className="text-[0.6rem] uppercase tracking-[0.35em] text-gray-500">
          Already have a token?{' '}
          <Link to="/activate-account" className="font-semibold text-gray-900 underline">
            Activate your account
          </Link>
        </p>
      </Card>
        </div>
      </div>
    </main>
  );
}
