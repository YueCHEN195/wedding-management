import { Alert, Button, Form, Input, Modal, QRCode, Space, Typography } from 'antd';
import type { CheckinEntryProps, CheckinEntryModel } from './useCheckinEntry';
export function CheckinEntryView({
  open,
  onClose,
  model,
}: Pick<CheckinEntryProps, 'open' | 'onClose'> & { model: CheckinEntryModel }) {
  const { url, setUrl, form, saving, busy, error, validUrl, local, submit } = model;
  return (
    <Modal
      className="admin-dialog"
      style={{ top: 'var(--space-6)', paddingBottom: 0 }}
      styles={{
        container: {
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100dvh - 2 * var(--space-6))',
        },
        header: { flexShrink: 0 },
        body: { minHeight: 0, overflowY: 'auto' },
        footer: { flexShrink: 0 },
      }}
      classNames={{ body: 'admin-module-scroll' }}
      title="扫码签到 / 代登记"
      open={open}
      onCancel={() => {
        if (!saving.current) onClose();
      }}
      footer={
        <Button disabled={busy} onClick={onClose}>
          关闭
        </Button>
      }
      mask={{ closable: !busy }}
      closable={!busy}
      keyboard={!busy}
    >
      <div className="checkin-entry-code">
        <QRCode
          value={validUrl ? url : ' '}
          status={validUrl ? 'active' : 'expired'}
          bordered={false}
        />
      </div>
      <Form autoComplete="off" layout="vertical">
        <Form.Item
          label="宾客签到地址"
          validateStatus={validUrl ? undefined : 'error'}
          help={validUrl ? undefined : '请填写完整的 http 或 https 地址'}
        >
          <Input
            autoComplete="off"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-label="宾客签到地址"
          />
        </Form.Item>
      </Form>
      {local && (
        <Alert
          type="warning"
          showIcon
          title="手机不能访问电脑的 localhost 地址"
          description="请改填同一网络内电脑的IP地址，或已部署的网站地址，然后重新扫码。"
        />
      )}
      <Space wrap>
        <Button
          href={validUrl ? url : undefined}
          target="_blank"
          rel="noopener noreferrer"
          disabled={!validUrl}
        >
          打开宾客签到页
        </Button>
      </Space>
      <Typography.Title level={5}>代填姓名，加入待审核</Typography.Title>
      <Typography.Paragraph type="secondary">
        宾客不便扫码时可代登记，成功后直接填写下一位。同名来宾会分别进入待审。
      </Typography.Paragraph>
      {error && <Alert type="error" showIcon title="提交未得到成功确认" description={error} />}
      <Form
        autoComplete="off"
        name="pending-entry"
        form={form}
        layout="vertical"
        onFinish={submit}
        disabled={busy}
      >
        <Form.Item
          name="name"
          label="来宾姓名"
          rules={[{ required: true, whitespace: true, max: 30, message: '请填写姓名（1–30字）' }]}
        >
          <Input aria-label="代登记来宾姓名" maxLength={30} autoComplete="off" />
        </Form.Item>
        <Space wrap>
          <Button type="primary" htmlType="submit" loading={busy}>
            加入待审核
          </Button>
        </Space>
      </Form>
    </Modal>
  );
}
