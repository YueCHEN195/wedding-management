import { Button, Layout, Menu, Tag, Typography } from 'antd';
import { Outlet } from 'react-router-dom';
import './tokens.css';
import './admin.css';
import { adminCssVariables } from './theme';
import { useAdminNavigation } from './session/useAdminNavigation';

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
  const { registerNavigationGuard, location, me, openRoute, logout } = useAdminNavigation();
  const menu = me?.role === 'staff' ? STAFF_MENU : MENU;

  return (
    <Layout className="admin-shell" style={adminCssVariables}>
      <Layout.Sider
        className="admin-sidebar"
        theme="dark"
        width={184}
        breakpoint="lg"
        collapsedWidth={0}
      >
        <div className="admin-brand">
          婚礼管理<small>WEDDING WORKSPACE</small>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menu}
          onClick={({ key }) => {
            void openRoute(key);
          }}
        />
      </Layout.Sider>
      <Layout className="admin-main">
        <Layout.Header className="admin-header">
          <Typography.Text type="secondary">
            婚礼管理 / {menu.find((item) => item.key === location.pathname)?.label ?? '工作台'}
          </Typography.Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Tag variant="filled">{me?.role === 'admin' ? '管理员' : '工作人员'}</Tag>
            <Typography.Text>{me?.username}</Typography.Text>
            <Button
              type="text"
              size="small"
              onClick={() => {
                void logout();
              }}
            >
              退出
            </Button>
          </div>
        </Layout.Header>
        <Layout.Content
          className={`admin-content${location.pathname === '/admin/review' ? ' admin-content-workbench' : ''}`}
        >
          <Outlet context={{ registerNavigationGuard } satisfies AdminOutletContext} />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
