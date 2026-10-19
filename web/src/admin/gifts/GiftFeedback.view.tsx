import { Alert, Button, Form, Select, Typography } from 'antd';
import { METHOD_LABEL, SIDE_LABEL, yuan } from '@/lib/format';
import type { GiftEditorModel } from './useGiftEditor';

export function GiftConflictFeedback({ model }: { model: GiftEditorModel }) {
  const { conflict, latest, recheckDraft } = model;
  if (!conflict) return null;
  return (
    <Alert
      type="warning"
      showIcon
      className="gift-feedback"
      title="请先核对最新账目，你的草稿已保留"
      description={
        <>
          {latest.isFetching ? (
            <p>正在读取最新记录…</p>
          ) : latest.isError ? (
            <p>无法读取最新记录，请重试。</p>
          ) : (
            latest.data && (
              <>
                <p>
                  最新记录：¥{yuan(latest.data.amount)} · {METHOD_LABEL[latest.data.method]} ·{' '}
                  {latest.data.voidedAt == null ? '有效' : '已撤回，当前不能更正'}
                </p>
                <p className="gift-long-text">最新备注：{latest.data.note || '未填'}</p>
                {latest.data.voidedAt == null && (
                  <Button onClick={recheckDraft}>保留我的修改，载入最新记录核对</Button>
                )}
              </>
            )
          )}
          <Button
            type="link"
            disabled={latest.isFetching}
            onClick={() => {
              void latest.refetch();
            }}
          >
            重新读取最新记录
          </Button>
        </>
      }
    />
  );
}

export function GiftCandidateSelection({ model }: { model: GiftEditorModel }) {
  const { editing, name, candidates, namePending } = model;
  if (editing || !name) return null;
  if (namePending)
    return (
      <Typography.Paragraph role="status" type="secondary">
        等待姓名输入完成…
      </Typography.Paragraph>
    );
  return (
    <>
      {(candidates.isPending || candidates.isFetching) && (
        <Typography.Paragraph>正在核对当前宾客名单…</Typography.Paragraph>
      )}
      {candidates.isError && (
        <Alert
          type="error"
          title="无法核对宾客名单，请重试"
          action={
            <Button
              onClick={() => {
                void candidates.refetch();
              }}
            >
              重试
            </Button>
          }
        />
      )}
      {!candidates.isFetching && candidates.isSuccess && candidates.data.length > 0 && (
        <Form.Item
          name="guestId"
          label="对应宾客"
          rules={[{ required: true, message: '请选择对应宾客，或明确选择单独记礼金' }]}
        >
          <Select
            placeholder="按编号、归属和分组核对"
            options={[
              ...candidates.data.map((g) => ({
                value: g.id as number | 'none',
                label: `#${g.id} · ${g.name} · ${g.side ? SIDE_LABEL[g.side] : '归属未填'} · ${g.groupName || '未分组'} · ${g.checkedIn ? '已签到' : '未签到'}`,
              })),
              { value: 'none' as const, label: '不关联当前宾客，单独记礼金' },
            ]}
            optionRender={(o) => <span className="gift-candidate-option">{o.label}</span>}
          />
        </Form.Item>
      )}
      {!candidates.isFetching && candidates.isSuccess && candidates.data.length === 0 && (
        <Typography.Paragraph type="secondary">
          未找到同名的当前宾客；此笔礼金将独立保存，不会自动建立宾客档案。
        </Typography.Paragraph>
      )}
    </>
  );
}
