import type { CheckinDTO } from '@shared/types';
import { Alert, Button, Descriptions, Space, Typography } from 'antd';
import { GuestDetailSummary } from '../components/GuestDetailSummary';
import { StatusTag } from '../components/StatusTag';
import { CHECKIN_STATUS_LABEL, METHOD_LABEL, SIDE_LABEL, formatDateTime, yuan } from '@/lib/format';
import type { ReviewDirectoryModel, ReviewDirectoryProps } from './useReviewDirectory';
import { reviewStatusLabels as labels } from './reviewStatusLabels';

export function ReviewGuestDetails({
  model,
  admin,
  disabled,
  onProcess,
}: ReviewDirectoryProps & { model: ReviewDirectoryModel }) {
  const { selected, setSelected, detail } = model;
  if (!selected) return null;
  return (
    <>
      {model.selectedProjection.isError && (
        <Alert
          type="warning"
          showIcon
          title="现场状态刷新失败，摘要为上次数据"
          action={
            <Button
              onClick={() => {
                void model.selectedProjection.refetch();
              }}
            >
              重试状态
            </Button>
          }
        />
      )}
      <ReviewGuestOverview model={model} admin={admin} />
      {selected.status !== 'confirmed' && (
        <section className="guest-detail-panel">
          <h3>现场核对</h3>
          <Typography.Paragraph type="secondary">
            核对本人及同行人数后确认到场，预计与实到分别记录。
          </Typography.Paragraph>
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
        </section>
      )}
      {selected.guestId != null && (
        <ReviewCheckinRecords model={model} admin={admin} disabled={disabled} />
      )}
      {admin && detail.data && <ReviewGiftRecords model={model} disabled={disabled} />}
      {admin && detail.data && (
        <section className="guest-detail-panel">
          <h3>档案补充</h3>
          <Descriptions
            column={1}
            size="small"
            items={[
              { key: 'phone', label: '联系方式', children: detail.data.guest.phone || '未填写' },
              { key: 'note', label: '备注', children: detail.data.guest.note || '未填写' },
            ]}
          />
        </section>
      )}
    </>
  );
}

function ReviewGuestOverview({
  model: { selected, detail, staffDetail },
  admin,
}: {
  model: ReviewDirectoryModel;
  admin: boolean;
}) {
  if (!selected) return null;
  const guest = admin ? detail.data?.guest : staffDetail.data?.guest;
  const side = guest?.side ?? selected.side;
  return (
    <GuestDetailSummary
      name={guest?.name ?? selected.name}
      identity={
        selected.guestId == null ? '待审核提交 · 未关联档案' : `宾客档案 #${selected.guestId}`
      }
      status={
        <StatusTag
          tone={
            selected.status === 'confirmed'
              ? 'success'
              : selected.status === 'pending'
                ? 'pending'
                : 'neutral'
          }
        >
          {labels[selected.status]}
        </StatusTag>
      }
      description={[guest?.groupName ?? selected.groupName ?? '未分组', side && SIDE_LABEL[side]]
        .filter(Boolean)
        .join(' · ')}
      facts={[
        {
          label: '回执预计',
          value: selected.expected == null ? '未确认出席' : `${selected.expected} 人`,
        },
        {
          label: '现场实到',
          value:
            selected.actual == null
              ? selected.status === 'confirmed'
                ? '待补记'
                : '待核对'
              : `${selected.actual} 人（含儿童）`,
        },
      ]}
    />
  );
}
function ReviewCheckinRecords({
  model,
  admin,
  disabled,
}: {
  model: ReviewDirectoryModel;
  admin: boolean;
  disabled: boolean;
}) {
  const { detail, staffDetail } = model;
  const records = (admin ? detail.data?.checkins : staffDetail.data?.checkins) ?? [];
  const query = admin ? detail : staffDetail;
  return (
    <section className="guest-detail-panel">
      <h3>签到记录</h3>
      {query.isPending && (
        <Typography.Paragraph role="status">正在读取签到记录…</Typography.Paragraph>
      )}
      {query.isError && (
        <Alert
          type="error"
          showIcon
          title="签到记录加载失败"
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
      )}
      {query.isSuccess && !records.length && (
        <Typography.Text type="secondary">尚无签到记录</Typography.Text>
      )}
      {records.map((record) => (
        <ReviewCheckinRecord
          key={record.id}
          record={record}
          model={model}
          admin={admin}
          disabled={disabled}
        />
      ))}
    </section>
  );
}
function ReviewCheckinRecord({
  record,
  model,
  admin,
  disabled,
}: {
  record: Pick<
    CheckinDTO,
    'id' | 'status' | 'actualHeadcount' | 'actualChildrenCount' | 'confirmedAt' | 'submittedAt'
  >;
  model: ReviewDirectoryModel;
  admin: boolean;
  disabled: boolean;
}) {
  const { detail } = model;
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
      {admin && (
        <Space wrap>
          {record.status === 'confirmed' && (
            <>
              <Button
                disabled={disabled || detail.isFetching || detail.isError}
                onClick={() => {
                  const row = detail.data?.checkins.find((row) => row.id === record.id);
                  if (row) model.attendanceEditor.openEdit(row);
                }}
              >
                {record.actualHeadcount == null ? '补记人数' : '更正人数'}
              </Button>
              <Button
                disabled={disabled}
                onClick={() =>
                  model.setAction({ entity: 'checkin', id: record.id, action: 'cancel' })
                }
              >
                撤销签到确认
              </Button>
            </>
          )}
          <Button type="text" onClick={() => model.setHistoryId(record.id)}>
            操作记录
          </Button>
        </Space>
      )}
    </div>
  );
}
function ReviewGiftRecords({
  model,
  disabled,
}: {
  model: ReviewDirectoryModel;
  disabled: boolean;
}) {
  const { detail } = model;
  if (!detail.data) return null;
  return (
    <section className="guest-detail-panel">
      <h3>礼金记录</h3>
      <Typography.Paragraph type="secondary">
        有效合计 ¥{yuan(detail.data.giftTotal)} · 仅统计有效登记
      </Typography.Paragraph>
      {detail.data.gifts.length ? (
        detail.data.gifts.map((gift) => (
          <div className="guest-detail-record" key={gift.id}>
            <div className="guest-detail-record-head">
              <strong>¥{yuan(gift.amount)}</strong>
              <StatusTag tone={gift.voidedAt ? 'inactive' : 'success'}>
                {gift.voidedAt ? '已作废' : METHOD_LABEL[gift.method]}
              </StatusTag>
            </div>
            <small>
              礼金 #{gift.id} · {formatDateTime(gift.recordedAt)}
            </small>
            {gift.note && <span>{gift.note}</span>}
            {gift.voidedAt == null && (
              <Space wrap>
                <Button
                  disabled={disabled || detail.isFetching || detail.isError}
                  onClick={() => model.giftEditor.openEdit(gift)}
                >
                  更正礼金
                </Button>
                <Button
                  disabled={disabled}
                  onClick={() => model.setAction({ entity: 'gift', id: gift.id, action: 'void' })}
                >
                  作废礼金
                </Button>
              </Space>
            )}
          </div>
        ))
      ) : (
        <Typography.Text type="secondary">尚未登记礼金</Typography.Text>
      )}
    </section>
  );
}
