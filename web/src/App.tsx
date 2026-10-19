import { useCurrentUser } from '@/api/useCurrentUser';
import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

const LoginPage = lazy(() => import('./admin/LoginPage').then((m) => ({ default: m.LoginPage })));
const AdminProviders = lazy(() =>
  import('./admin/AdminProviders').then((m) => ({ default: m.AdminProviders })),
);
const RequireAuth = lazy(() =>
  import('./admin/RequireAuth').then((m) => ({ default: m.RequireAuth })),
);
const AdminLayout = lazy(() =>
  import('./admin/AdminLayout').then((m) => ({ default: m.AdminLayout })),
);
const DashboardPage = lazy(() =>
  import('./admin/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const GuestsPage = lazy(() =>
  import('./admin/GuestsPage').then((m) => ({ default: m.GuestsPage })),
);
const RsvpsPage = lazy(() => import('./admin/RsvpsPage').then((m) => ({ default: m.RsvpsPage })));
const ReviewPage = lazy(() =>
  import('./admin/ReviewPage').then((m) => ({ default: m.ReviewPage })),
);
const CheckinsPage = lazy(() =>
  import('./admin/CheckinsPage').then((m) => ({ default: m.CheckinsPage })),
);
const GiftsPage = lazy(() => import('./admin/GiftsPage').then((m) => ({ default: m.GiftsPage })));
const ExportPage = lazy(() =>
  import('./admin/ExportPage').then((m) => ({ default: m.ExportPage })),
);
const InvitePage = lazy(() =>
  import('./invite/InvitePage').then((m) => ({ default: m.InvitePage })),
);
const CheckinPage = lazy(() =>
  import('./checkin/CheckinPage').then((m) => ({ default: m.CheckinPage })),
);

function PageFallback() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '50vh', color: '#999' }}>
      加载中…
    </div>
  );
}

/** 非管理员（工作人员）进入后台首页时，重定向到现场审核 */
function AdminIndex() {
  const me = useCurrentUser();
  if (me.data?.role === 'staff') return <Navigate to="/admin/review" replace />;
  return <DashboardPage />;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const me = useCurrentUser();
  if (!me.data) return <PageFallback />;
  return me.data.role === 'admin' ? <>{children}</> : <Navigate to="/admin/review" replace />;
}

export function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route
          path="/login"
          element={
            <AdminProviders>
              <LoginPage />
            </AdminProviders>
          }
        />

        {/* 宾客端 */}
        <Route path="/invite" element={<InvitePage />} />
        <Route path="/invite/:token" element={<InvitePage />} />
        <Route path="/checkin" element={<CheckinPage />} />

        {/* 管理后台 */}
        <Route
          path="/admin"
          element={
            <AdminProviders>
              <RequireAuth>
                <AdminLayout />
              </RequireAuth>
            </AdminProviders>
          }
        >
          <Route index element={<AdminIndex />} />
          <Route path="guests" element={<GuestsPage />} />
          <Route
            path="rsvps"
            element={
              <RequireAdmin>
                <RsvpsPage />
              </RequireAdmin>
            }
          />
          <Route path="review" element={<ReviewPage />} />
          <Route path="checkins" element={<CheckinsPage />} />
          <Route path="gifts" element={<GiftsPage />} />
          <Route
            path="export"
            element={
              <RequireAdmin>
                <ExportPage />
              </RequireAdmin>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Suspense>
  );
}
