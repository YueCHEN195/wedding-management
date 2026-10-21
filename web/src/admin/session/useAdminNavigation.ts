import { useCallback, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useCurrentUser } from '@/api/useCurrentUser';
import { replaceSession } from '@/api/session';
export function useAdminNavigation() {
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const logoutLock = useRef(false);
  const navigationGuard = useRef<(() => Promise<boolean>) | null>(null);
  const registerNavigationGuard = useCallback((guard: () => Promise<boolean>) => {
    navigationGuard.current = guard;
    return () => {
      if (navigationGuard.current === guard) navigationGuard.current = null;
    };
  }, []);
  const canNavigate = async () => !navigationGuard.current || (await navigationGuard.current());
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();

  const openRoute = async (key: string) => {
    if (key !== location.pathname && (await canNavigate())) void navigate(key);
  };
  const logout = async () => {
    if (logoutLock.current) return;
    logoutLock.current = true;
    try {
      if (!(await canNavigate())) return;
      setLogoutPending(true);
      setLogoutError(null);
      await api.logout();
      await replaceSession(queryClient, null);
      void navigate('/login', { replace: true });
    } catch (error) {
      setLogoutError(`退出未完成：${error instanceof Error ? error.message : '请检查连接后重试'}`);
    } finally {
      logoutLock.current = false;
      setLogoutPending(false);
    }
  };
  return { registerNavigationGuard, location, me, openRoute, logout, logoutPending, logoutError };
}
