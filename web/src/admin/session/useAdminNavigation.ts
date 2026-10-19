import { useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { useCurrentUser } from '@/api/useCurrentUser';
import { replaceSession } from '@/api/session';
export function useAdminNavigation() {
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
    if (!(await canNavigate())) return;
    await api.logout();
    await replaceSession(queryClient, null);
    void navigate('/login', { replace: true });
  };
  return { registerNavigationGuard, location, me, openRoute, logout };
}
