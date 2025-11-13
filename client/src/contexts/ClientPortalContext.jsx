import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

function createInitialState() {
  return {
    loading: true,
    error: null,
    profile: null,
    appointments: [],
    notifications: { items: [], unread_count: 0 },
    documents: [],
    sharedDocuments: [],
    recentActions: []
  };
}

const ClientPortalContext = createContext(null);

export function ClientPortalProvider({ children }) {
  const { isUser } = useAuth();
  const navigate = useNavigate();
  const mountedRef = useRef(true);
  const [state, setState] = useState(createInitialState);
  const navigateRef = useRef(navigate);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  const fetchDashboard = useCallback(async () => {
    if (!isUser) {
      setState(createInitialState());
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const payload = await apiGet('/api/dashboard/user');
      if (!mountedRef.current) {
        return;
      }
      setState({
        loading: false,
        error: null,
        profile: payload.profile ?? null,
        appointments: payload.appointments ?? [],
        notifications: payload.notifications ?? { items: [], unread_count: 0 },
        documents: payload.documents ?? [],
        sharedDocuments: payload.shared_documents ?? [],
        recentActions: payload.recent_actions ?? []
      });
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }
      if (error.status === 401) {
        navigateRef.current('/auth', { replace: true });
        return;
      }
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Unable to load your portal right now.'
      }));
    }
  }, [isUser]);

  useEffect(() => {
    if (!isUser) {
      setState(createInitialState());
      return;
    }
    void fetchDashboard();
  }, [fetchDashboard, isUser]);

  const value = useMemo(
    () => ({
      ...state,
      refresh: fetchDashboard
    }),
    [state, fetchDashboard]
  );

  return <ClientPortalContext.Provider value={value}>{children}</ClientPortalContext.Provider>;
}

export function useClientPortal() {
  const context = useContext(ClientPortalContext);
  if (!context) {
    throw new Error('useClientPortal must be used within a ClientPortalProvider');
  }
  return context;
}
