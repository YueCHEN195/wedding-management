import { Alert, Button, Form, Input, Select, Typography } from 'antd';
import type { UseQueryResult } from '@tanstack/react-query';
import type { GuestCandidate } from '@shared/types';
import { ATTENDING_LABEL, SIDE_LABEL } from '@/lib/format';
export function GuestSelection({
  query,
  waitingForName = false,
}: {
  query: UseQueryResult<GuestCandidate[], Error>;
  waitingForName?: boolean;
}) {
  const form = Form.useFormInstance();
  const selection = Form.useWatch('guestId', form);
  if (waitingForName)
    return (
      <Typography.Paragraph role="status" type="secondary">
        等待姓名输入完成…
      </Typography.Paragraph>
    );
  if (query.isPending) return <Typography.Paragraph>正在核对宾客名单…</Typography.Paragraph>;
  if (query.isError)
    return (
      <Alert
        type="error"
        showIcon
        title="宾客名单加载失败，请重试后再确认"
        action={
          <Button
            onClick={() => {
              void query.refetch();
            }}
          >
            重试
          </Button>
        }
      />
    );
  const candidates = query.data;
  if (candidates.length === 0)
    return (
      <Typography.Paragraph type="secondary">
        未找到同名宾客，确认后将自动建立新档案。
      </Typography.Paragraph>
    );
  const label = (g: GuestCandidate) =>
    `#${g.id} · ${g.name} · ${g.checkedIn ? '已签到' : '未签到'} · ${g.side ? SIDE_LABEL[g.side] : '归属未填'} · ${g.groupName || '未分组'} · ${g.attending ? ATTENDING_LABEL[g.attending] : '未回执'}${g.attending === 'yes' ? ` ${g.headcount}人（儿童${g.childrenCount ?? 0}人）` : ''}`;
  return (
    <>
      {candidates.length > 1 && (
        <Alert type="warning" showIcon title="有多位同名宾客，请核对分组与归属后选择本人" />
      )}
      <Form.Item
        name="guestId"
        label="对应宾客"
        rules={[{ required: true, message: '请选择对应宾客，或新增另一位同名宾客' }]}
      >
        <Select
          placeholder="核对已有宾客，或新增另一位同名宾客"
          options={[
            ...candidates.map((g) => ({
              value: g.id as number | 'new',
              label: label(g),
              disabled: g.checkedIn,
            })),
            { value: 'new' as const, label: '都不是，新增另一位同名宾客' },
          ]}
          optionRender={(option) => <span style={{ whiteSpace: 'normal' }}>{option.label}</span>}
        />
      </Form.Item>
      {selection === 'new' && (
        <>
          <Typography.Paragraph type="secondary">
            确认是另一位本人后再新建；同一人追加礼金请到礼金管理登记。
          </Typography.Paragraph>
          <Form.Item
            name={['newGuest', 'groupName']}
            label="辨识分组"
            preserve={false}
            rules={[
              { required: true, whitespace: true, max: 50, message: '请填写辨识分组（最多50字）' },
            ]}
          >
            <Input placeholder="例如：新郎同事带来的朋友" maxLength={50} />
          </Form.Item>
          <Form.Item name={['newGuest', 'side']} label="归属方（可选）" preserve={false}>
            <Select
              allowClear
              placeholder="请选择"
              options={Object.entries(SIDE_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
        </>
      )}
    </>
  );
}
