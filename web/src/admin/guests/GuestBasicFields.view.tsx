import { Form, Input } from 'antd';
import { MAX_NAME_LENGTH } from '@shared/constraints';
import { MOBILE_PHONE_PATTERN, MOBILE_PHONE_MESSAGE } from '@shared/guestInput';
// Salutation uses the existing server text limit.
const SHORT_FIELD_LIMIT = 30;
export function GuestBasicFields() {
  return (
    <section className="guest-editor-section">
      <h2>基本信息</h2>
      <Form.Item
        name="name"
        label="姓名"
        rules={[
          {
            required: true,
            whitespace: true,
            max: MAX_NAME_LENGTH,
            message: '请填写姓名（1–50字）',
          },
        ]}
      >
        <Input maxLength={MAX_NAME_LENGTH} autoFocus autoComplete="off" />
      </Form.Item>
      <div className="guest-form-grid">
        <Form.Item
          name="salutation"
          label="请柬称谓"
          extra="用于请柬上的称呼，可留空。"
          rules={[{ max: SHORT_FIELD_LIMIT }]}
        >
          <Input autoComplete="off" maxLength={SHORT_FIELD_LIMIT} placeholder="如：张先生" />
        </Form.Item>
        <Form.Item
          name="phone"
          label="手机号"
          normalize={(value: string) => value.trim()}
          rules={[{ pattern: MOBILE_PHONE_PATTERN, message: MOBILE_PHONE_MESSAGE }]}
        >
          <Input
            autoComplete="off"
            maxLength={11}
            inputMode="tel"
            placeholder="11位手机号，可留空"
          />
        </Form.Item>
      </div>
    </section>
  );
}
