import { Alert, Form, Input, List, Modal, Typography } from 'antd';
import type { LifecycleAction, OperationLogDTO } from '@shared/types';
import { formatDateTime, yuan } from '@/lib/format';
import { ACTION_LABEL, type RecordActionTarget } from './types';
import type { RecordActionModel, useRecordHistory } from './useRecordAction';
function History({ rows }: { rows: OperationLogDTO[] }) {
  return (
    <List
      size="small"
      locale={{ emptyText: '暂无操作记录' }}
      dataSource={rows}
      renderItem={(r) => (
        <List.Item>
          <div>
            {formatDateTime(r.createdAt)} · {r.actorName} ·{' '}
            {r.action === 'create'
              ? '登记礼金'
              : r.action === 'edit'
                ? '更正礼金'
                : r.action === 'attendance'
                  ? '补记／更正到场人数'
                  : (ACTION_LABEL[r.action as LifecycleAction] ?? r.action)}
            <br />
            {r.detail && (
              <>
                {r.detail}
                <br />
              </>
            )}
            原因：{r.reason}
          </div>
        </List.Item>
      )}
    />
  );
}
export function RecordActionView({
  target,
  onClose,
  model: { form, preview, submit },
}: {
  target: RecordActionTarget;
  onClose: () => void;
  model: RecordActionModel;
}) {
  return (
    <Modal
      open
      width={640}
      style={{ top: 24 }}
      styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' } }}
      title={ACTION_LABEL[target.action]}
      onCancel={() => {
        if (!submit.isPending) onClose();
      }}
      okText="确认操作"
      onOk={() => form.submit()}
      confirmLoading={submit.isPending}
      okButtonProps={{ disabled: preview.isFetching || !preview.data || preview.isError }}
      cancelButtonProps={{ disabled: submit.isPending }}
    >
      {preview.isPending && <Typography.Paragraph>正在核对对象与关联数据…</Typography.Paragraph>}
      {preview.isError && <Alert type="error" title={preview.error.message} showIcon />}
      {preview.data && (
        <>
          <Typography.Title level={5}>
            {preview.data.name} · #{preview.data.id}
          </Typography.Title>
          <Typography.Paragraph>
            关联回执 {preview.data.rsvpCount} 份 · 签到 {preview.data.checkinCount} 条 · 礼金{' '}
            {preview.data.giftCount} 笔（原登记 ¥{yuan(preview.data.originalGiftTotal)}，当前有效 ¥
            {yuan(preview.data.giftTotal)}）
          </Typography.Paragraph>
          <Alert
            showIcon
            type="warning"
            title="本次操作的影响"
            description={preview.data.effect}
            style={{ marginBottom: 16 }}
          />
          <Form form={form} layout="vertical" onFinish={(v) => submit.mutate(v)}>
            <Form.Item
              name="reason"
              label="操作原因"
              rules={[
                { required: true, whitespace: true, max: 200, message: '请填写原因（最多200字）' },
              ]}
            >
              <Input.TextArea
                rows={2}
                maxLength={200}
                showCount
                disabled={submit.isPending}
                placeholder={`请说明${ACTION_LABEL[target.action]}的具体原因`}
              />
            </Form.Item>
          </Form>
          <Typography.Text type="secondary">
            如果确认期间对象或关联数据发生变化，将要求重新核对。
          </Typography.Text>
          <Typography.Title level={5}>此前操作记录</Typography.Title>
          <div style={{ maxHeight: 140, overflowY: 'auto' }}>
            <History rows={preview.data.history} />
          </div>
        </>
      )}
    </Modal>
  );
}
export function RecordHistoryView({
  id,
  onClose,
  query,
}: {
  id: number;
  onClose: () => void;
  query: ReturnType<typeof useRecordHistory>;
}) {
  return (
    <Modal
      open
      styles={{ body: { maxHeight: '65vh', overflowY: 'auto' } }}
      title={`操作记录 · #${id}`}
      onCancel={onClose}
      footer={null}
    >
      {query.isPending ? (
        '正在读取…'
      ) : query.isError ? (
        <Alert type="error" title={query.error.message} />
      ) : (
        <History rows={query.data} />
      )}
    </Modal>
  );
}
