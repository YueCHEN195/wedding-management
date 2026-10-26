import { Alert, Button, Form, Modal, Select, Typography } from 'antd';
import { yuan } from '@/lib/format';
import { ReasonInput } from '../components/ReasonInput';
import { adminCssVariables } from '../theme';
import type { CheckinReassignmentModel } from './useCheckinReassignment';
const reasons = ['同名宾客选错档案', '现场核对发现认错宾客', '原签到关联有误'];
export function CheckinReassignment({ model }: { model: CheckinReassignmentModel }) {
  const { record, preview, form, save, candidates } = model;
  return (
    <Modal
      className="admin-dialog"
      style={{ ...adminCssVariables, top: 'var(--space-6)', paddingBottom: 0 }}
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
      title={`纠正关联宾客 · ${record?.name ?? ''} · 签到 #${record?.id ?? ''}`}
      open={record != null}
      onCancel={() => {
        void model.close();
      }}
      onOk={() => form.submit()}
      okText="确认纠正关联"
      confirmLoading={save.isPending}
      okButtonProps={{ disabled: !preview.data || preview.isFetching || preview.isError }}
      cancelButtonProps={{ disabled: save.isPending }}
      closable={!save.isPending}
      keyboard={!save.isPending}
      mask={{ closable: !save.isPending }}
    >
      <Typography.Paragraph>
        仅用于认错宾客或选错档案。同名请按编号、分组核对，不会合并已有签到。
      </Typography.Paragraph>
      <Form
        name="checkin-reassignment"
        form={form}
        layout="vertical"
        disabled={save.isPending}
        onValuesChange={() => model.setDirty(true)}
        onFinish={(values) => save.mutate(values)}
      >
        <Form.Item
          name="guestId"
          label="正确的宾客档案"
          rules={[{ required: true, message: '请明确选择目标档案' }]}
        >
          <Select
            showSearch={{ filterOption: false, onSearch: model.setKeyword }}
            loading={model.searching || candidates.isFetching}
            placeholder="输入姓名查找，再核对编号"
            options={(candidates.data?.items ?? [])
              .filter((row) => row.guestId != null)
              .map((row) => ({
                value: row.guestId!,
                label: `#${row.guestId} · ${row.name} · ${row.groupName || '未分组'} · ${row.status === 'confirmed' ? '已签到' : row.status === 'pending' ? '待审核' : '未签到'}`,
              }))}
          />
        </Form.Item>
        {candidates.isError && (
          <Alert
            type="error"
            title="宾客搜索失败"
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
        {preview.isError && <Alert type="warning" showIcon title={preview.error.message} />}
        {save.isError && (
          <Alert
            type="error"
            showIcon
            title="关联尚未更改，输入已保留"
            description={save.error.message}
            action={
              <Button
                onClick={() => {
                  void preview.refetch();
                }}
              >
                重新核对
              </Button>
            }
          />
        )}
        {preview.data && (
          <Alert
            type="warning"
            showIcon
            title="请核对本次影响"
            description={
              <>
                <p>
                  {preview.data.from.name} #{preview.data.from.id ?? '未关联'} →{' '}
                  {preview.data.to.name} #{preview.data.to.id}
                </p>
                <p>
                  同步移动此签到及下列关联礼金（含已作废历史），人数、金额与有效状态不变；原档案、回执和独立礼金保留。
                </p>
                {preview.data.gifts.length ? (
                  preview.data.gifts.map((gift) => (
                    <p key={gift.id}>
                      礼金 #{gift.id} · ¥{yuan(gift.amount)} · {gift.voidedAt ? '已作废' : '有效'}
                    </p>
                  ))
                ) : (
                  <p>本次没有关联礼金。</p>
                )}
              </>
            }
          />
        )}
        <Form.Item
          name="reason"
          label="纠正原因"
          rules={[
            { required: true, whitespace: true, max: 200, message: '请填写原因（最多200字）' },
          ]}
        >
          <ReasonInput reasons={reasons} maxLength={200} rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
