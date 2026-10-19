import { useCurrentUser } from '@/api/useCurrentUser';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { data, isLoading, isError } = useCurrentUser();

  if (isLoading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
        <Spin />
      </div>
    );
  }

  if (isError || !data) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
