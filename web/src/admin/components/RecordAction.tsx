import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Form, Input, List, Modal, Typography, message } from 'antd';
import { api, ApiError } from '@/api/client';
import type { LifecycleAction, LifecycleEntity, OperationLogDTO } from '@shared/types';
import { formatDateTime, yuan } from '@/lib/format';

export interface RecordActionTarget { entity: LifecycleEntity; id: number; action: LifecycleAction }
export const ACTION_LABEL: Record<LifecycleAction, string> = { archive: '归档宾客', restore: '恢复记录', reject: '驳回提交', cancel: '撤销确认', void: '作废礼金' };
function History({ rows }: { rows: OperationLogDTO[] }) {
  return <List size="small" locale={{ emptyText: '暂无操作记录' }} dataSource={rows} renderItem={(r) => <List.Item>
    <div>{formatDateTime(r.createdAt)} · {r.actorName} · {r.action === 'attendance' ? '补记／更正到场人数' : ACTION_LABEL[r.action as LifecycleAction] ?? r.action}<br />{r.detail && <>{r.detail}<br /></>}原因：{r.reason}</div>
  </List.Item>} />;
}
export function RecordAction({ target, onClose }: { target: RecordActionTarget; onClose: () => void }) {
  const qc = useQueryClient();
  const [form] = Form.useForm<{ reason: string }>();
  const preview = useQuery({ queryKey: ['action-preview', target.entity, target.id, target.action],
    queryFn: () => api.lifecycle.preview(target.entity, target.id, target.action), staleTime: 0, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false });
  const submit = useMutation({
    mutationFn: (v: { reason: string }) => api.lifecycle.apply(target.entity, target.id, { ...v, action: target.action, token: preview.data!.token }),
    onSuccess: () => {
      for (const key of ['guests', 'guest-groups', 'guest-detail', 'rsvps', 'checkins', 'checkin-candidates', 'gifts', 'stats', 'record-history', 'action-preview']) {
        qc.invalidateQueries({ queryKey: [key] });
      }
      message.success('操作已保存，原记录和操作历史已保留'); onClose();
    },
    onError: (e) => {
      message.error(e instanceof ApiError ? e.message : '操作失败，请重试');
      preview.refetch();
    },
  });
  return <Modal open width={640} style={{ top: 24 }} styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' } }} title={ACTION_LABEL[target.action]} onCancel={() => { if (!submit.isPending) onClose(); }}
    okText="确认操作" onOk={() => form.submit()} confirmLoading={submit.isPending}
    okButtonProps={{ disabled: preview.isFetching || !preview.data || preview.isError }} cancelButtonProps={{ disabled: submit.isPending }}>
    {preview.isPending && <Typography.Paragraph>正在核对对象与关联数据…</Typography.Paragraph>}
    {preview.isError && <Alert type="error" title={preview.error.message} showIcon />}
    {preview.data && <>
      <Typography.Title level={5}>{preview.data.name} · #{preview.data.id}</Typography.Title>
      <Typography.Paragraph>关联回执 {preview.data.rsvpCount} 份 · 签到 {preview.data.checkinCount} 条 · 礼金 {preview.data.giftCount} 笔（原登记 ¥{yuan(preview.data.originalGiftTotal)}，当前有效 ¥{yuan(preview.data.giftTotal)}）</Typography.Paragraph>
      <Alert showIcon type="warning" title="本次操作的影响" description={preview.data.effect} style={{ marginBottom: 16 }} />
      <Form form={form} layout="vertical" onFinish={(v) => submit.mutate(v)}>
        <Form.Item name="reason" label="操作原因" rules={[{ required: true, whitespace: true, max: 200, message: '请填写原因（最多200字）' }]}>
          <Input.TextArea rows={2} maxLength={200} showCount disabled={submit.isPending} placeholder={`请说明${ACTION_LABEL[target.action]}的具体原因`} />
        </Form.Item>
      </Form>
      <Typography.Text type="secondary">如果确认期间对象或关联数据发生变化，将要求重新核对。</Typography.Text>
      <Typography.Title level={5}>此前操作记录</Typography.Title><div style={{ maxHeight: 140, overflowY: 'auto' }}><History rows={preview.data.history} /></div>
    </>}
  </Modal>;
}
export function RecordHistory({ entity, id, onClose }: { entity: LifecycleEntity; id: number; onClose: () => void }) {
  const query = useQuery({ queryKey: ['record-history', entity, id], queryFn: () => api.lifecycle.history(entity, id), retry: false });
  return <Modal open styles={{ body: { maxHeight: '65vh', overflowY: 'auto' } }} title={`操作记录 · #${id}`} onCancel={onClose} footer={null}>
    {query.isPending ? '正在读取…' : query.isError ? <Alert type="error" title={query.error.message} /> : <History rows={query.data} />}
  </Modal>;
}
