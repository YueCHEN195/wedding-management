import { Alert, Button, Form, Input } from 'antd';
import { ArrowRightOutlined, PauseOutlined, CaretRightOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';
import { adminCssVariables, adminPalette } from '../theme';
import type { LoginModel } from './useLogin';
import '../tokens.css';
import './login.css';

const loginVariables = {
  ...adminCssVariables,
  '--login-paper': adminPalette.page,
} as CSSProperties;

export function LoginView({ model }: { model: LoginModel }) {
  return (
    <main className="admin-login" style={loginVariables} data-paused={model.motionPaused}>
      <section className="login-brand" aria-label="婚礼管理">
        <div className="login-brand-name">
          <span className="login-mark" aria-hidden />
          婚礼管理<span>WEDDING CONSOLE</span>
        </div>
        <div className="login-brand-content">
          <p className="login-eyebrow">FOR EVERY MOMENT TOGETHER</p>
          <h1>
            相聚有序，
            <br />
            <span>心意有归。</span>
          </h1>
          <p className="login-brand-description">
            从一份邀请，到每一次到来。
            <br />
            让重要的日子，从容发生。
          </p>
        </div>
        <div className="login-art" aria-hidden="true">
          <div className="login-orbit">
            <span />
          </div>
          <div className="login-disc" />
          <div className="login-arch" />
          <div className="login-satellite" />
          <span className="login-art-caption">相 · 逢</span>
        </div>
        <div className="login-brand-footer">
          <span>筹备 · 相聚 · 珍藏</span>
          <Button
            type="text"
            className="login-motion-toggle"
            aria-pressed={model.motionPaused}
            icon={
              model.motionPaused ? (
                <CaretRightOutlined aria-hidden />
              ) : (
                <PauseOutlined aria-hidden />
              )
            }
            onClick={model.toggleMotion}
          >
            {model.motionPaused ? '播放动态' : '暂停动态'}
          </Button>
        </div>
      </section>
      <section className="login-entry" aria-labelledby="login-title">
        <div className="login-form-wrap">
          <p className="login-eyebrow">WELCOME BACK</p>
          <h2 id="login-title">欢迎回来</h2>
          <p className="login-intro">登录婚礼管理后台，继续准备美好的一天。</p>
          <Form<{ username: string; password: string }>
            layout="vertical"
            requiredMark={false}
            onFinish={model.submit}
            disabled={model.loading}
            aria-busy={model.loading}
          >
            <Form.Item
              name="username"
              label="账号"
              rules={[{ required: true, message: '请输入账号' }]}
            >
              <Input
                size="large"
                autoComplete="username"
                placeholder="请输入账号"
                autoCapitalize="none"
                spellCheck={false}
              />
            </Form.Item>
            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                size="large"
                autoComplete="current-password"
                placeholder="请输入密码"
              />
            </Form.Item>
            {model.error && (
              <Alert
                className="login-error"
                type="error"
                showIcon
                title={model.error}
                description="输入已保留，请核对后重试。若无法登录，请联系管理员。"
              />
            )}
            <Button
              className="login-submit"
              size="large"
              type="primary"
              htmlType="submit"
              block
              loading={model.loading}
            >
              {model.loading ? '正在登录…' : '进入管理后台'}
              <ArrowRightOutlined aria-hidden />
            </Button>
          </Form>
          <p className="login-helper">请使用管理员分配的账号。登录后按账号权限进入后台。</p>
        </div>
        <footer className="login-entry-footer">每一份到来，都值得认真以待。</footer>
      </section>
    </main>
  );
}
