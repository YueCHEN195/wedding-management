import { Button, Descriptions, Dropdown, Space, Tag, Typography } from 'antd';
import {
  ATTENDING_LABEL,
  CHECKIN_STATUS_LABEL,
  METHOD_LABEL,
  SIDE_LABEL,
  STATUS_LABEL,
  formatDateTime,
  yuan,
} from '@/lib/format';
import { copyLink } from './guestFeedback';
import { guestMenu } from './guestMenu';
import type { GuestManagementModel } from './useGuestManagement';
type Props = Pick<
  GuestManagementModel,
  'guest' | 'detail' | 'markSent' | 'setMedia' | 'setHistoryId' | 'setAction'
>;
export function GuestDetails({ model }: { model: Props }) {
  const { guest, detail } = model;
  if (!guest) return null;
  const rowMenu = () => guestMenu(guest, model);
  return (
    <>
      <section className="guest-detail-section">
        <h2>
          {guest.name} {guest.archivedAt != null && <Tag>已归档</Tag>}
        </h2>
        <Descriptions
          column={1}
          size="small"
          items={[
            { key: 'salutation', label: '请柬称谓', children: guest.salutation || '—' },
            { key: 'phone', label: '手机号', children: guest.phone || '—' },
            {
              key: 'group',
              label: '分组 / 归属',
              children:
                [guest.groupName, guest.side && SIDE_LABEL[guest.side]]
                  .filter(Boolean)
                  .join(' · ') || '—',
            },
            { key: 'status', label: '邀请状态', children: STATUS_LABEL[guest.status] },
            {
              key: 'note',
              label: '备注',
              children: <span className="guest-plain-text">{guest.note || '—'}</span>,
            },
          ]}
        />
        <Space wrap>
          {guest.archivedAt == null && (
            <>
              <Button
                onClick={() => {
                  void copyLink(guest);
                }}
              >
                复制邀请链接
              </Button>
              <Button
                href={`/invite/${encodeURIComponent(guest.inviteToken)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                预览请柬
              </Button>
            </>
          )}
          <Dropdown trigger={['click']} menu={{ items: rowMenu() }}>
            <Button>更多操作 ▾</Button>
          </Dropdown>
        </Space>
      </section>
      <section className="guest-detail-section">
        <h2>回执</h2>
        {detail.data?.rsvp ? (
          <Descriptions
            column={1}
            size="small"
            items={[
              {
                key: 'attending',
                label: '是否出席',
                children: ATTENDING_LABEL[detail.data.rsvp.attending],
              },
              {
                key: 'count',
                label: '预计人数',
                children: `${detail.data.rsvp.headcount}人（含儿童${detail.data.rsvp.childrenCount}人）`,
              },
              {
                key: 'message',
                label: '祝福留言',
                children: (
                  <span className="guest-plain-text">{detail.data.rsvp.message || '—'}</span>
                ),
              },
            ]}
          />
        ) : (
          <Typography.Text type="secondary">尚未填写回执</Typography.Text>
        )}
      </section>
      <section className="guest-detail-section">
        <h2>签到记录（{detail.data?.checkins.length ?? 0}）</h2>
        <div className="guest-record-list">
          {detail.data?.checkins.length ? (
            detail.data.checkins.map((c) => (
              <div className="guest-record-row" key={c.id}>
                <div>
                  <Tag>{CHECKIN_STATUS_LABEL[c.status]}</Tag>
                  <Typography.Text type="secondary">
                    {formatDateTime(c.confirmedAt ?? c.submittedAt)}
                  </Typography.Text>
                </div>
                <span>
                  {c.actualHeadcount == null
                    ? '人数待核对／补记'
                    : `实到${c.actualHeadcount}人（含儿童${c.actualChildrenCount ?? '未记录'}人）`}
                </span>
              </div>
            ))
          ) : (
            <Typography.Text type="secondary">尚无签到记录</Typography.Text>
          )}
        </div>
      </section>
      <section className="guest-detail-section">
        <h2>礼金记录 · 有效合计 ¥{yuan(detail.data?.giftTotal)}</h2>
        <div className="guest-record-list">
          {detail.data?.gifts.length ? (
            detail.data.gifts.map((g) => (
              <div className="guest-record-row" key={g.id}>
                <div>
                  <Typography.Text delete={g.voidedAt != null}>¥{yuan(g.amount)}</Typography.Text> ·{' '}
                  {METHOD_LABEL[g.method]}
                  {g.voidedAt != null && <Tag>已作废，不计入合计</Tag>}
                </div>
                <Typography.Text type="secondary">{formatDateTime(g.recordedAt)}</Typography.Text>
              </div>
            ))
          ) : (
            <Typography.Text type="secondary">尚未登记礼金</Typography.Text>
          )}
        </div>
      </section>
    </>
  );
}
