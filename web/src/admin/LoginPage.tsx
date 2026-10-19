import { Button, Card, Form, Input, Typography } from 'antd';
import { useLogin } from './session/useLogin';
export function LoginPage() {
  const { loading, setLoading, login } = useLogin();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--brand-paper)',
        padding: 16,
      }}
    >
      <Card style={{ width: 360 }}>
        <Typography.Title level={3} style={{ textAlign: 'center', color: 'var(--brand-red)' }}>
          婚礼后台
        </Typography.Title>
        <Form
          layout="vertical"
          onFinish={(values) => {
            setLoading(true);
            login.mutate(values as { username: string; password: string });
          }}
        >
          <Form.Item
            name="username"
            label="账号"
            rules={[{ required: true, message: '请输入账号' }]}
          >
            <Input autoComplete="username" placeholder="admin / staff" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  );
}
