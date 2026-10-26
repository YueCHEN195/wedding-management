import { Alert, Button, Dropdown, Space, Typography } from 'antd';
import type { CheckinDTO } from '@shared/types';
import { CHECKIN_STATUS_LABEL, METHOD_LABEL, formatDateTime, yuan } from '@/lib/format';
import { StatusTag } from '../components/StatusTag';
import type { ReviewDirectoryModel } from './useReviewDirectory';
type Props = { model: ReviewDirectoryModel; admin: boolean; disabled: boolean };
type Record = Pick<
  CheckinDTO,
  'id' | 'status' | 'actualHeadcount' | 'actualChildrenCount' | 'confirmedAt' | 'submittedAt'
>;
export function ReviewCheckinRecord({
  record,
  model,
  admin,
  disabled,
}: Props & { record: Record }) {
  const query = admin ? model.detail : model.staffDetail;
  const busy = disabled || query.isFetching || query.isError;
  const identity = { guestId: model.selected!.guestId, guestName: model.selected!.name };
  return (
    <div className="guest-detail-record">
      <div className="guest-detail-record-head">
        <strong>签到 #{record.id}</strong>
        <StatusTag tone={record.status === 'confirmed' ? 'success' : 'neutral'}>
          {CHECKIN_STATUS_LABEL[record.status]}
        </StatusTag>
      </div>
      <span>
        {record.actualHeadcount == null
          ? '实际人数未记录'
          : `实到 ${record.actualHeadcount} 人（儿童 ${record.actualChildrenCount ?? '未记录'} 人）`}
      </span>
      <small>
        {record.confirmedAt ? '确认于' : '提交于'}{' '}
        {formatDateTime(record.confirmedAt ?? record.submittedAt)}
      </small>
      <Space wrap>
        {record.status === 'confirmed' && (
          <>
            <Button
              disabled={busy}
              onClick={() => model.attendanceEditor.openEdit({ ...record, ...identity })}
            >
              {record.actualHeadcount == null ? '补记人数' : '更正人数'}
            </Button>
            <Button
              disabled={busy}
              onClick={() => model.giftEditor.openForCheckin({ id: record.id, ...identity })}
            >
              补登记礼金
            </Button>
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  {
                    key: 'reassign',
                    label: '纠正关联宾客',
                    onClick: () => model.reassignment.open(record.id, identity.guestName),
                  },
                  {
                    key: 'cancel',
                    label: '撤销签到确认',
                    danger: true,
                    onClick: () =>
                      model.setAction({ entity: 'checkin', id: record.id, action: 'cancel' }),
                  },
                ],
              }}
            >
              <Button disabled={busy}>处理错误登记</Button>
            </Dropdown>
          </>
        )}
        {record.status === 'pending' && (
          <Button
            disabled={busy}
            onClick={() => model.setAction({ entity: 'checkin', id: record.id, action: 'reject' })}
          >
            驳回提交
          </Button>
        )}
        {(record.status === 'rejected' || record.status === 'cancelled') && (
          <Button
            disabled={busy}
            onClick={() => model.setAction({ entity: 'checkin', id: record.id, action: 'restore' })}
          >
            {record.status === 'cancelled' ? '恢复签到' : '恢复待审'}
          </Button>
        )}
        <Button
          type="text"
          onClick={() => model.setHistoryTarget({ entity: 'checkin', id: record.id })}
        >
          操作记录
        </Button>
      </Space>
    </div>
  );
}
export function ReviewGiftRecords({ model, admin, disabled }: Props) {
  const query = admin ? model.detail : model.staffDetail;
  const gifts = (admin ? model.detail.data?.gifts : model.staffDetail.data?.gifts) ?? [];
  if (!model.selected?.guestId) return null;
  return (
    <section className="guest-detail-panel">
      <h3>礼金记录</h3>
      {admin && model.detail.data && (
        <Typography.Paragraph type="secondary">
          有效合计 ¥{yuan(model.detail.data.giftTotal)} · 仅统计有效登记
        </Typography.Paragraph>
      )}
      {!admin && (
        <Typography.Paragraph type="secondary">
          仅展示此宾客签到关联的单笔礼金。
        </Typography.Paragraph>
      )}
      {query.isError && <Alert type="error" title="礼金记录加载失败" />}
      {query.isSuccess && !gifts.length && (
        <Typography.Text type="secondary">尚未登记礼金</Typography.Text>
      )}
      {gifts.map((gift) => (
        <div className="guest-detail-record" key={gift.id}>
          <div className="guest-detail-record-head">
            <strong>¥{yuan(gift.amount)}</strong>
            <StatusTag tone={gift.voidedAt ? 'inactive' : 'success'}>
              {gift.voidedAt ? '已作废' : METHOD_LABEL[gift.method]}
            </StatusTag>
          </div>
          <small>
            礼金 #{gift.id} · 签到 #{gift.checkinId ?? '未关联'} · {formatDateTime(gift.recordedAt)}
          </small>
          {gift.note && <span>{gift.note}</span>}
          <Space wrap>
            {gift.voidedAt == null && (
              <Button
                disabled={disabled || query.isFetching || query.isError}
                onClick={() => model.giftEditor.openEdit(gift)}
              >
                更正礼金
              </Button>
            )}
            <Button
              disabled={disabled || query.isFetching || query.isError}
              onClick={() =>
                model.setAction({
                  entity: 'gift',
                  id: gift.id,
                  action: gift.voidedAt ? 'restore' : 'void',
                })
              }
            >
              {gift.voidedAt ? '恢复礼金' : '作废礼金'}
            </Button>
            <Button
              type="text"
              onClick={() => model.setHistoryTarget({ entity: 'gift', id: gift.id })}
            >
              操作记录
            </Button>
          </Space>
        </div>
      ))}
    </section>
  );
}
