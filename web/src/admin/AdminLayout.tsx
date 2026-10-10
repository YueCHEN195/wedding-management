import { Layout, Menu, Tag, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';

const MENU = [
  { key: '/admin', label: '仪表盘' },
  { key: '/admin/guests', label: '宾客管理' },
  { key: '/admin/rsvps', label: '回执管理' },
  { key: '/admin/review', label: '现场审核' },
  { key: '/admin/checkins', label: '签到记录' },
  { key: '/admin/gifts', label: '礼金管理' },
  { key: '/admin/export', label: '导出' },
];

const STAFF_MENU_KEYS = ['/admin/review', '/admin/checkins', '/admin/gifts', '/admin/guests'];

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: api.me });

  const menu = me?.role === 'staff' ? MENU.filter((m) => STAFF_MENU_KEYS.includes(m.key)) : MENU;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Sider theme="light" breakpoint="lg" collapsedWidth={0}>
        <div
          style={{
            height: 56,
            display: 'grid',
            placeItems: 'center',
            fontWeight: 700,
            color: 'var(--brand-red)',
          }}
        >
          婚礼后台
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menu}
          onClick={({ key }) => navigate(key)}
        />
      </Layout.Sider>
      <Layout>
        <Layout.Header
          style={{
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingInline: 16,
          }}
        >
          <Typography.Text strong>管理后台</Typography.Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Tag color={me?.role === 'admin' ? 'red' : 'blue'}>
              {me?.role === 'admin' ? '管理员' : '工作人员'}
            </Tag>
            <Typography.Text>{me?.username}</Typography.Text>
            <a
              onClick={async () => {
                await api.logout();
                await queryClient.invalidateQueries();
                navigate('/login', { replace: true });
              }}
            >
              退出
            </a>
          </div>
        </Layout.Header>
        <Layout.Content style={{ padding: 16 }}>
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
