import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useCurrentUser } from '@/api/useCurrentUser';
import { replaceSession } from '@/api/session';
export function useAdminNavigation() {
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const logoutLock = useRef(false);
  const navigationGuards = useRef(new Set<() => Promise<boolean>>());
  const registerNavigationGuard = useCallback((guard: () => Promise<boolean>) => {
    navigationGuards.current.add(guard);
    return () => {
      navigationGuards.current.delete(guard);
    };
  }, []);
  const canNavigate = useCallback(async () => {
    for (const guard of navigationGuards.current) {
      if (!(await guard())) return false;
    }
    return true;
  }, []);
  const blocker = useBlocker(
    ({ historyAction }) => historyAction === 'POP' && navigationGuards.current.size > 0,
  );
  const checkingHistory = useRef(false);
  useEffect(() => {
    if (blocker.state !== 'blocked' || checkingHistory.current) return;
    checkingHistory.current = true;
    void canNavigate()
      .then((allowed) => {
        if (allowed) blocker.proceed();
        else blocker.reset();
      })
      .finally(() => {
        checkingHistory.current = false;
      });
  }, [blocker, canNavigate]);
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
