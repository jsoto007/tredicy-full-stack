import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, resetCsrfToken, setCsrfToken } from '../lib/api.js';

const AuthContext = createContext(null);

const STATUS = {
  loading: 'loading',
  authenticated: 'authenticated',
  unauthenticated: 'unauthenticated',
  error: 'error'
};

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    status: STATUS.loading,
    role: null,
    account: null,
    error: null
  });

  const refreshSession = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      status: STATUS.loading,
      error: null
    }));
    try {
      const session = await apiGet('/api/auth/session');
      setState({
        status: STATUS.authenticated,
        role: session?.role ?? null,
        account: session?.account ?? null,
        error: null
      });
      if (session?.csrf_token) {
        setCsrfToken(session.csrf_token);
      }
      return session;
    } catch (error) {
      if (error.status === 401) {
        setState({
          status: STATUS.unauthenticated,
          role: null,
          account: null,
          error: null
        });
        resetCsrfToken();
        return null;
      }

      setState({
        status: STATUS.error,
        role: null,
        account: null,
        error: 'Unable to verify session.'
      });
      resetCsrfToken();

      return null;
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const logout = useCallback(async () => {
    try {
      await apiPost('/api/auth/logout', {});
    } catch {
      // Ignore network failures; local auth state still resets below.
    } finally {
      resetCsrfToken();
      setState({
        status: STATUS.unauthenticated,
        role: null,
        account: null,
        error: null
      });
    }
  }, []);

  const value = useMemo(
    () => ({
      status: state.status,
      role: state.role,
      account: state.account,
      error: state.error,
      isAuthenticated: state.status === STATUS.authenticated && !!state.role,
      isLoading: state.status === STATUS.loading,
      isAdmin: state.role === 'admin',
      isUser: state.role === 'user',
      refreshSession,
      logout
    }),
    [state, refreshSession, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
