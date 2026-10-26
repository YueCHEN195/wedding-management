import { Alert, Button, Descriptions, Typography } from 'antd';
import { GuestDetailSummary } from '../components/GuestDetailSummary';
import { StatusTag } from '../components/StatusTag';
import { SIDE_LABEL } from '@/lib/format';
import type { ReviewDirectoryModel, ReviewDirectoryProps } from './useReviewDirectory';
import { ReviewCheckinRecord, ReviewGiftRecords } from './ReviewRecordActions.view';
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
      <ReviewGiftRecords model={model} admin={admin} disabled={disabled} />
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
