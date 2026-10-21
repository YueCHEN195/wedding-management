import { StatusTag } from '../components/StatusTag';
import { Alert, Button, Descriptions, Empty, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { StaffGuestDTO } from '@shared/types';
import { ATTENDING_LABEL, CHECKIN_STATUS_LABEL, SIDE_LABEL, formatDateTime } from '@/lib/format';
import { AdminDrawer } from '../components/AdminDrawer';
import { GuestListTools } from '../components/GuestListTools';
import { PageHeader } from '../components/PageHeader';
import { TableText } from '../components/TableText';

import type { StaffGuestsModel } from './useStaffGuests';
const STAFF_TABLE_WIDTH = 740;
const ARCHIVE_STATUS_WIDTH = 100;
export function StaffGuestsView({ model }: { model: StaffGuestsModel }) {
  const { params, setParams, setDetailId, list } = model;
  const columns: ColumnsType<StaffGuestDTO> = [
    {
      title: '宾客',
      width: 180,
      fixed: 'left',
      render: (_, r) => (
        <div className="guest-name-cell">
          <Tooltip title={r.name} trigger={['hover', 'focus']}>
            <Button type="link" onClick={() => setDetailId(r.id)}>
              <span className="guest-name-label">{r.name}</span>
            </Button>
          </Tooltip>
          <span className="guest-muted">#{r.id}</span>
        </div>
      ),
    },
    {
      title: '分组 / 归属',
      width: 180,
      ellipsis: { showTitle: false },
      render: (_, r) => (
        <TableText
          value={[r.groupName, r.side ? SIDE_LABEL[r.side] : null].filter(Boolean).join(' · ')}
        />
      ),
    },
    {
      title: '回执',
      ellipsis: { showTitle: false },
      render: (_, r) => (
        <TableText
          value={
            r.attending
              ? `${ATTENDING_LABEL[r.attending]}${r.attending === 'yes' ? ` · ${attendanceText(r.headcount, r.childrenCount)}` : ''}`
              : '未填回执'
          }
        />
      ),
    },
    ...(params.archived
      ? [
          {
            title: '档案状态',
            width: ARCHIVE_STATUS_WIDTH,
            render: (_: unknown, r: StaffGuestDTO) => (
              <Tag>{r.archivedAt != null ? '已归档' : '当前宾客'}</Tag>
            ),
          },
        ]
      : []),
    {
      title: '签到',
      width: 110,
      render: (_, r) => (
        <StatusTag tone={r.checkedIn ? 'success' : 'neutral'}>
          {r.checkedIn ? '已签到' : '未签到'}
        </StatusTag>
      ),
    },
  ];
  return (
    <div className="guest-list-page">
      <PageHeader title="宾客查询" description="快速核对分组、出席回执与签到记录。" />
      <GuestListTools
        params={params}
        onChange={(patch) => setParams((p) => ({ ...p, ...patch, page: 1 }))}
      />
      <div className="guest-list-toolbar">
        <span className="guest-result-count">
          {list.data
            ? `当前范围 ${list.data.total} 位宾客`
            : list.isError
              ? '名单暂不可用'
              : '正在加载名单…'}
        </span>
      </div>
      {list.isError && (
        <Alert
          type="error"
          showIcon
          title={list.data ? '名单刷新失败，当前显示上次数据' : '宾客查询失败'}
          action={<Button onClick={() => list.refetch()}>重试</Button>}
        />
      )}
      <Table<StaffGuestDTO>
        className="guest-list-table"
        rowKey="id"
        columns={columns}
        dataSource={list.data?.items ?? []}
        loading={list.isPending}
        size="small"
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                list.isError
                  ? '连接失败，暂时无法获取名单'
                  : params.keyword
                    ? '没有找到这位宾客，请检查姓名或切换范围'
                    : params.archived === 'only'
                      ? '还没有已归档宾客'
                      : '还没有宾客档案'
              }
            />
          ),
        }}
        scroll={{ x: STAFF_TABLE_WIDTH + (params.archived ? ARCHIVE_STATUS_WIDTH : 0) }}
        pagination={{
          current: params.page,
          pageSize: params.pageSize,
          total: list.data?.total,
          showSizeChanger: false,
          onChange: (page) => setParams((p) => ({ ...p, page })),
        }}
      />
      <StaffGuestDetails model={model} />
    </div>
  );
}

function StaffGuestDetails({ model }: { model: StaffGuestsModel }) {
  const { detailId, setDetailId, detail } = model;
  const guest = detail.data?.guest;
  return (
    <AdminDrawer
      rootClassName="guest-drawer"
      title={guest ? `${guest.name} · #${guest.id}` : '宾客详情'}
      open={detailId != null}
      onClose={() => setDetailId(null)}
      footer={
        <div className="admin-drawer-footer">
          <Button onClick={() => setDetailId(null)}>关闭</Button>
        </div>
      }
    >
      {detail.isPending && (
        <Typography.Paragraph role="status">正在读取宾客档案…</Typography.Paragraph>
      )}
      {detail.isError && (
        <Alert
          type="error"
          showIcon
          title="详情加载失败"
          action={<Button onClick={() => detail.refetch()}>重试</Button>}
        />
      )}
      {guest && (
        <>
          <section className="guest-detail-section">
            <h2>现场核对 {guest.archivedAt != null && <Tag>已归档</Tag>}</h2>
            <Descriptions
              column={1}
              size="small"
              items={[
                {
                  key: 'group',
                  label: '分组 / 归属',
                  children:
                    [guest.groupName, guest.side && SIDE_LABEL[guest.side]]
                      .filter(Boolean)
                      .join(' · ') || '—',
                },
                {
                  key: 'rsvp',
                  label: '回执',
                  children: guest.attending ? ATTENDING_LABEL[guest.attending] : '未填回执',
                },
                ...(guest.attending === 'yes'
                  ? [
                      {
                        key: 'count',
                        label: '预计到场',
                        children: attendanceText(guest.headcount, guest.childrenCount),
                      },
                    ]
                  : []),
                {
                  key: 'checkin',
                  label: '签到',
                  children: guest.checkedIn ? '✓ 已签到' : '— 未签到',
                },
              ]}
            />
          </section>
          <section className="guest-detail-section">
            <h2>签到记录</h2>
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
                        ? '人数未记录'
                        : `实到${attendanceText(c.actualHeadcount, c.actualChildrenCount)}`}
                    </span>
                  </div>
                ))
              ) : (
                <Typography.Text type="secondary">尚无签到记录</Typography.Text>
              )}
            </div>
          </section>
        </>
      )}
    </AdminDrawer>
  );
}

function attendanceText(total: number | null, children: number | null) {
  if (total == null) return '人数未记录';
  return `${total}人（${children == null ? '儿童人数未记录' : `含儿童${children}人`}）`;
}
