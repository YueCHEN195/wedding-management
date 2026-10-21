import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/api/client';
import { replaceSession } from '@/api/session';
export function useLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const submitLock = useRef(false);
  const [motionPaused, setMotionPaused] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/admin';

  const login = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      api.login(username, password),
    onSuccess: async (user) => {
      await replaceSession(queryClient, user);
      void navigate(from, { replace: true });
    },
    onSettled: () => {
      submitLock.current = false;
    },
  });
  const submit = (values: { username: string; password: string }) => {
    if (submitLock.current) return;
    submitLock.current = true;
    login.mutate(values);
  };
  return {
    loading: login.isPending,
    error: login.error
      ? login.error instanceof ApiError
        ? login.error.message
        : '登录失败，请稍后重试'
      : null,
    submit,
    motionPaused,
    toggleMotion: () => setMotionPaused((paused) => !paused),
  };
}

export type LoginModel = ReturnType<typeof useLogin>;
