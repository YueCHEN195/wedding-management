import { Form, Input, Radio, Select, Typography } from 'antd';
import { parseGiftYuan } from '@shared/numericInput';
import { METHOD_LABEL } from '@/lib/format';
export function OptionalGiftFields() {
  const form = Form.useFormInstance();
  const received = Form.useWatch('giftReceipt', form) === 'received';
  return (
    <>
      <Form.Item name="giftReceipt" label="礼金登记" rules={[{ required: true }]}>
        <Radio.Group
          options={[
            { value: 'received', label: '同时登记礼金' },
            { value: 'none', label: '仅签到，不登记礼金' },
          ]}
        />
      </Form.Item>
      {!received && (
        <Typography.Paragraph type="secondary">
          宾客可不赠送礼金，确认后只记录签到。之后收到礼金可到礼金管理单独登记。
        </Typography.Paragraph>
      )}
      {received && (
        <div className="review-money-fields">
          <Form.Item
            name="amountYuan"
            label="实收礼金（元）"
            preserve={false}
            rules={[
              { required: true, message: '请填写实际收到的金额' },
              {
                validator: (_, v) =>
                  parseGiftYuan(v) != null
                    ? Promise.resolve()
                    : Promise.reject(new Error('金额须为0.01–100000元，最多两位小数')),
              },
            ]}
          >
            <Input
              autoComplete="off"
              inputMode="decimal"
              maxLength={12}
              placeholder="例如：600.00"
            />
          </Form.Item>
          <Form.Item
            name="method"
            label="收款方式"
            initialValue="cash"
            preserve={false}
            rules={[{ required: true, message: '请选择收款方式' }]}
          >
            <Select
              options={Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
        </div>
      )}
    </>
  );
}
