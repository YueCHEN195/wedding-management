import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { api, ApiError } from '@/api/client';
import { replaceSession } from '@/api/session';
export function useLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/admin';

  const login = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      api.login(username, password),
    onSuccess: async (user) => {
      await replaceSession(queryClient, user);
      void navigate(from, { replace: true });
    },
    onError: (err) => {
      message.error(err instanceof ApiError ? err.message : '登录失败');
    },
    onSettled: () => setLoading(false),
  });
  return { loading, setLoading, login };
}
