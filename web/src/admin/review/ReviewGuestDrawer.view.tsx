import { AdminDrawer } from '../components/AdminDrawer';
import { Alert, Button, Descriptions, Form, Input, Select, Space, Typography } from 'antd';
import { MAX_NAME_LENGTH, MAX_TEXT_LENGTH } from '@shared/constraints';
import { METHOD_LABEL, SIDE_LABEL, formatDateTime, yuan } from '@/lib/format';
import type { ReviewDirectoryModel, ReviewDirectoryProps } from './useReviewDirectory';
import { reviewStatusLabels as labels } from './reviewStatusLabels';
export function ReviewGuestDrawer({
  model,
  ...props
}: ReviewDirectoryProps & { model: ReviewDirectoryModel }) {
  const { selected, editing, setDirty, form, detail, update, close, openEdit } = model;
  const { admin, disabled } = props;
  return (
    <AdminDrawer
      title={`${selected?.name ?? '宾客详情'}${selected?.guestId ? ` · #${selected.guestId}` : ' · 未匹配档案'}`}
      size="var(--drawer-detail-width)"
      open={selected != null}
      onClose={close}
      footer={
        <div className="admin-drawer-footer">
          <Button onClick={close} disabled={update.isPending}>
            关闭
          </Button>
          {editing ? (
            <Button
              type="primary"
              loading={update.isPending}
              disabled={model.conflict || model.rechecking || !!detail.data?.guest.archivedAt}
              onClick={() => form.submit()}
            >
              保存修改
            </Button>
          ) : (
            admin &&
            selected?.guestId != null && (
              <Button
                disabled={
                  !detail.data ||
                  detail.isFetching ||
                  detail.isError ||
                  disabled ||
                  !!detail.data.guest.archivedAt
                }
                onClick={openEdit}
              >
                编辑档案
              </Button>
            )
          )}
        </div>
      }
    >
      {detail.isError && admin && (
        <Alert
          type="error"
          title="档案加载失败"
          action={<Button onClick={() => detail.refetch()}>重试</Button>}
        />
      )}
      <ReviewGuestSaveFeedback model={model} />
      {editing ? (
        <Form
          form={form}
          layout="vertical"
          disabled={update.isPending}
          onValuesChange={() => setDirty(true)}
          onFinish={(v) => update.mutate({ ...v, side: v.side ?? null })}
        >
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, whitespace: true, max: MAX_NAME_LENGTH }]}
          >
            <Input maxLength={MAX_NAME_LENGTH} />
          </Form.Item>
          <Form.Item name="groupName" label="分组" rules={[{ max: 50 }]}>
            <Input maxLength={50} />
          </Form.Item>
          <Form.Item name="side" label="归属方">
            <Select
              allowClear
              options={Object.entries(SIDE_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
          <Form.Item name="note" label="备注" rules={[{ max: MAX_TEXT_LENGTH }]}>
            <Input.TextArea rows={4} maxLength={MAX_TEXT_LENGTH} />
          </Form.Item>
        </Form>
      ) : (
        <ReviewGuestDetails {...props} model={model} />
      )}
    </AdminDrawer>
  );
}

function ReviewGuestDetails({
  model,
  admin,
  disabled,
  onProcess,
  onNavigate,
}: ReviewDirectoryProps & { model: ReviewDirectoryModel }) {
  const { selected, setSelected, detail, giftEditor } = model;
  if (!selected) return null;
  return (
    <>
      <Descriptions
        column={1}
        items={[
          {
            key: 'group',
            label: '分组',
            children: detail.data?.guest.groupName ?? selected.groupName ?? '未填写',
          },
          { key: 'status', label: '签到', children: labels[selected.status] },
          {
            key: 'expected',
            label: '预计人数',
            children: selected.expected == null ? '未确认出席' : `${selected.expected}人`,
          },
          {
            key: 'actual',
            label: '实际人数',
            children: selected.actual == null ? '未记录' : `${selected.actual}人（含儿童）`,
          },
          { key: 'actor', label: '确认操作人', children: '未记录' },
          ...(admin
            ? [
                {
                  key: 'gift',
                  label: '有效礼金',
                  children: detail.data
                    ? `¥${yuan(detail.data.giftTotal)}`
                    : selected.giftTotal == null
                      ? '未登记'
                      : `¥${yuan(selected.giftTotal)}`,
                },
                {
                  key: 'note',
                  label: '备注',
                  children: detail.data?.guest.note ?? selected.note ?? '—',
                },
              ]
            : []),
        ]}
      />
      {selected.status === 'confirmed' ? (
        <>
          <Typography.Paragraph type="secondary">
            已签到，无需重复确认。更正到场人数或礼金时，请在对应记录中填写更正原因。
          </Typography.Paragraph>
          <Space wrap>
            <Button onClick={() => onNavigate('/admin/checkins')}>签到记录 / 人数更正</Button>
          </Space>
        </>
      ) : (
        <Button
          type="primary"
          disabled={disabled}
          onClick={() => {
            onProcess(selected);
            setSelected(null);
          }}
        >
          进入核对
        </Button>
      )}
      {admin && detail.data && (
        <section className="review-section">
          <h3>礼金记录</h3>
          {detail.data.gifts.length ? (
            detail.data.gifts.map((gift) => (
              <div className="review-secondary-action" key={gift.id}>
                <Typography.Paragraph>
                  #{gift.id} · ¥{yuan(gift.amount)} · {METHOD_LABEL[gift.method]} ·{' '}
                  {formatDateTime(gift.recordedAt)}
                  {gift.voidedAt != null && ' · 已作废'}
                </Typography.Paragraph>
                <Button
                  disabled={
                    disabled || detail.isFetching || detail.isError || gift.voidedAt != null
                  }
                  onClick={() => giftEditor.openEdit(gift)}
                >
                  更正礼金
                </Button>
              </div>
            ))
          ) : (
            <Typography.Text type="secondary">尚未登记礼金</Typography.Text>
          )}
        </section>
      )}
    </>
  );
}

function ReviewGuestSaveFeedback({ model }: { model: ReviewDirectoryModel }) {
  if (!model.update.isError) return null;
  return (
    <Alert
      type="error"
      showIcon
      title="修改未保存，输入已保留"
      description={model.update.error.message}
      action={
        model.conflict ? (
          <Button
            loading={model.rechecking}
            onClick={() => {
              void model.recheckDraft();
            }}
          >
            保留修改并载入最新档案
          </Button>
        ) : undefined
      }
    />
  );
}
