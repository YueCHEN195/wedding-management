import { Alert, Button, Form, Select, Space, Typography } from 'antd';
import type { UseQueryResult } from '@tanstack/react-query';
import type { GuestCandidate } from '@shared/types';
import { ATTENDING_LABEL, SIDE_LABEL } from '@/lib/format';
import { otherPendingIds, type GuestSelectionState } from './guestSelection';
export function GuestSelection({
  query,
  identity,
  onOpenPending,
  waitingForName = false,
}: {
  query: UseQueryResult<GuestCandidate[], Error>;
  identity: GuestSelectionState;
  onOpenPending: (id: number) => void;
  waitingForName?: boolean;
}) {
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
  const pending = (guest: GuestCandidate) => otherPendingIds(guest, identity.checkinId).length > 0;
  const rank = (guest: GuestCandidate) => (guest.checkedIn ? 2 : pending(guest) ? 1 : 0);
  const label = (guest: GuestCandidate) =>
    `#${guest.id} · ${guest.name} · ${guest.checkedIn ? '已签到' : pending(guest) ? '已有待审核提交' : '未签到'} · ${guest.side ? SIDE_LABEL[guest.side] : '归属未填'} · ${guest.groupName || '未分组'} · ${guest.attending ? ATTENDING_LABEL[guest.attending] : '未回执'}${guest.attending === 'yes' ? ` ${guest.headcount}人（儿童${guest.childrenCount ?? 0}人）` : ''}`;
  return (
    <>
      {identity.pendingIds.length > 0 && (
        <Alert
          type="warning"
          showIcon
          title="已有同名待审核记录，请先核对是否为同一位来宾"
          description={
            <Space wrap>
              {identity.pendingIds.map((id) => (
                <Button key={id} type="link" onClick={() => onOpenPending(id)}>
                  查看待审 #{id}
                </Button>
              ))}
            </Space>
          }
        />
      )}
      {identity.blocked && (
        <Alert
          type="warning"
          showIcon
          title="所选宾客的现场状态已变化，请重新核对"
          description="当前选择与人数已保留；请选择可核对的宾客，或明确新增另一位同名宾客。"
        />
      )}
      <Form.Item
        hidden={!identity.showSelection}
        name="guestId"
        label="对应宾客"
        rules={[{ required: true, message: '请选择对应宾客，或新增另一位同名宾客' }]}
      >
        <Select
          placeholder="核对已有宾客，或新增另一位同名宾客"
          options={[
            ...[...candidates]
              .sort((a, b) => rank(a) - rank(b))
              .map((guest) => ({
                value: guest.id as number | 'new',
                label: label(guest),
                disabled: guest.checkedIn || pending(guest),
              })),
            { value: 'new' as const, label: '都不是，新增另一位同名宾客' },
          ]}
          optionRender={(option) => <span style={{ whiteSpace: 'normal' }}>{option.label}</span>}
        />
      </Form.Item>
      {identity.ownTemporary && (
        <Typography.Paragraph type="secondary">
          本次扫码已建立临时档案 #{identity.selection}，确认时复用该档案。
        </Typography.Paragraph>
      )}
      {identity.selection === 'new' && (
        <Typography.Paragraph type="secondary">
          {identity.allCheckedIn && '已有同名宾客均已签到。'}
          <span>本次新增独立档案，归入“临时到场”。</span>
        </Typography.Paragraph>
      )}
    </>
  );
}
