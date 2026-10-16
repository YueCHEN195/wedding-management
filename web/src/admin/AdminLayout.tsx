import { useCallback, useRef } from 'react';
import { Button, Layout, Menu, Tag, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import './tokens.css';
import './admin.css';
import { adminCssVariables } from './theme';
import { replaceSession } from '@/api/session';

const MENU = [
  { key: '/admin', label: '仪表盘' },
  { key: '/admin/guests', label: '宾客管理' },
  { key: '/admin/rsvps', label: '回执管理' },
  { key: '/admin/review', label: '现场审核' },
  { key: '/admin/checkins', label: '签到记录' },
  { key: '/admin/gifts', label: '礼金管理' },
  { key: '/admin/export', label: '导出' },
];

const STAFF_MENU = [
  { key: '/admin/review', label: '现场审核' },
  { key: '/admin/checkins', label: '签到记录' },
  { key: '/admin/guests', label: '宾客查询' },
  { key: '/admin/gifts', label: '礼金记录' },
];

export interface AdminOutletContext {
  registerNavigationGuard: (guard: () => Promise<boolean>) => () => void;
}
export function AdminLayout() {
  const navigationGuard = useRef<(() => Promise<boolean>) | null>(null);
  const registerNavigationGuard = useCallback((guard: () => Promise<boolean>) => {
    navigationGuard.current = guard;
    return () => { if (navigationGuard.current === guard) navigationGuard.current = null; };
  }, []);
  const canNavigate = async () => !navigationGuard.current || await navigationGuard.current();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: api.me });

  const menu = me?.role === 'staff' ? STAFF_MENU : MENU;

  return (
    <Layout className="admin-shell" style={adminCssVariables}>
      <Layout.Sider className="admin-sidebar" theme="dark" width={184} breakpoint="lg" collapsedWidth={0}>
        <div className="admin-brand">婚礼管理<small>WEDDING WORKSPACE</small></div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menu}
          onClick={async ({ key }) => { if (key !== location.pathname && await canNavigate()) navigate(key); }}
        />
      </Layout.Sider>
      <Layout className="admin-main">
        <Layout.Header className="admin-header">
          <Typography.Text type="secondary">婚礼管理 / {menu.find((item) => item.key === location.pathname)?.label ?? '工作台'}</Typography.Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Tag variant="filled">
              {me?.role === 'admin' ? '管理员' : '工作人员'}
            </Tag>
            <Typography.Text>{me?.username}</Typography.Text>
            <Button type="text" size="small"
              onClick={async () => {
                if (!await canNavigate()) return;
                await api.logout();
                await replaceSession(queryClient, null);
                navigate('/login', { replace: true });
              }}
            >
              退出
            </Button>
          </div>
        </Layout.Header>
        <Layout.Content className={`admin-content${location.pathname === '/admin/review' ? ' admin-content-workbench' : ''}`}>
          <Outlet context={{ registerNavigationGuard } satisfies AdminOutletContext} />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
