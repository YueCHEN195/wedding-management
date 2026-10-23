import { Button, Dropdown, Empty, Space, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { CheckinDTO, CheckinStatus, GiftMethod } from '@shared/types';
import { CHECKIN_STATUS_LABEL, METHOD_LABEL, formatDateTime, yuan } from '@/lib/format';
import { StatusTag, type StatusTone } from '../components/StatusTag';
import { TableText } from '../components/TableText';
import type { CheckinsModel } from './useCheckinsPage';
const checkinTone: Record<CheckinStatus, StatusTone> = {
  pending: 'pending',
  confirmed: 'success',
  rejected: 'error',
  cancelled: 'inactive',
};
// Preserve both timestamps and gift lifecycle without squeezing text on narrow screens.
const TABLE_WIDTH = 1590;
export function CheckinTable({ model }: { model: CheckinsModel }) {
  const { params, setParams, list } = model;
  return (
    <Table<CheckinDTO>
      className="checkin-table"
      size="small"
      rowKey="id"
      columns={checkinColumns(model)}
      dataSource={list.data?.items ?? []}
      loading={list.isPending}
      scroll={{ x: TABLE_WIDTH }}
      locale={{
        emptyText: (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              list.isError
                ? '连接失败，暂时无法获取签到记录'
                : params.keyword || params.status
                  ? '没有符合条件的签到记录'
                  : '还没有签到记录'
            }
          />
        ),
      }}
      pagination={{
        current: params.page,
        pageSize: params.pageSize,
        total: list.data?.total,
        showSizeChanger: true,
        onChange: (page, pageSize) =>
          setParams((p) => ({ ...p, page: p.pageSize !== pageSize ? 1 : page, pageSize })),
      }}
    />
  );
}
function checkinColumns(model: CheckinsModel): ColumnsType<CheckinDTO> {
  return [
    {
      title: '姓名 / 签到编号',
      width: 190,
      fixed: 'left',
      render: (_, r) => (
        <div className="checkin-identity">
          <span className="checkin-id">{r.guestId == null ? '未关联' : `#${r.guestId}`}</span>
          <TableText value={r.guestName} />
          <span className="checkin-id">签到 #{r.id}</span>
        </div>
      ),
    },
    {
      title: '签到状态',
      dataIndex: 'status',
      width: 100,
      render: (v: CheckinStatus) => (
        <StatusTag tone={checkinTone[v]}>{CHECKIN_STATUS_LABEL[v]}</StatusTag>
      ),
    },
    {
      title: '实到总人数',
      dataIndex: 'actualHeadcount',
      width: 100,
      align: 'right',
      render: (v: number | null, r) =>
        v ?? (r.status === 'confirmed' || r.status === 'cancelled' ? '待补记' : '待核对'),
    },
    {
      title: '其中儿童',
      dataIndex: 'actualChildrenCount',
      width: 90,
      align: 'right',
      render: (v: number | null) => v ?? '未记录',
    },
    {
      title: '礼金（元）',
      width: 110,
      align: 'right',
      render: (_, r) => (
        <span className={r.giftVoided ? 'checkin-gift-voided' : undefined}>
          {r.giftAmount == null
            ? r.status === 'confirmed'
              ? '未登记'
              : '—'
            : `¥${yuan(r.giftAmount)}`}
        </span>
      ),
    },
    {
      title: '礼金状态',
      width: 100,
      render: (_, r) =>
        r.giftVoided ? (
          <StatusTag tone="inactive">已作废</StatusTag>
        ) : r.giftAmount != null ? (
          '有效'
        ) : (
          '未登记'
        ),
    },
    {
      title: '方式',
      dataIndex: 'giftMethod',
      width: 90,
      render: (v: GiftMethod | null) => (v ? METHOD_LABEL[v] : '—'),
    },
    {
      title: '来源',
      dataIndex: 'source',
      width: 90,
      render: (v) => (v === 'self' ? '自助扫码' : '手动补录'),
    },
    {
      title: '备注',
      dataIndex: 'note',
      ellipsis: { showTitle: false },
      render: (v: string | null) => <TableText value={v} />,
    },
    { title: '提交时间', dataIndex: 'submittedAt', width: 160, render: formatDateTime },
    { title: '确认时间', dataIndex: 'confirmedAt', width: 160, render: formatDateTime },
    {
      title: '操作',
      align: 'right',
      // Four-character attendance action plus the more menu must fit on one line.
      width: 160,
      fixed: 'right',
      render: (_, r) => <CheckinActions row={r} model={model} />,
    },
  ];
}
function CheckinActions({
  row: r,
  model: { me, openEdit, setAction, setHistoryId },
}: {
  row: CheckinDTO;
  model: CheckinsModel;
}) {
  const admin = me.data?.role === 'admin';
  return (
    <Space size="small">
      {r.status === 'confirmed' && admin && (
        <Button type="link" onClick={() => openEdit(r)}>
          {r.actualHeadcount == null ? '补记人数' : '更正人数'}
        </Button>
      )}
      <Dropdown
        trigger={['click']}
        menu={{
          items: [
            { key: 'history', label: '操作记录', onClick: () => setHistoryId(r.id) },
            ...(r.status === 'pending'
              ? [
                  {
                    key: 'reject',
                    label: '驳回签到',
                    danger: true,
                    onClick: () => setAction({ entity: 'checkin', id: r.id, action: 'reject' }),
                  },
                ]
              : []),
            ...(r.status === 'confirmed' && admin
              ? [
                  {
                    key: 'cancel',
                    label: '撤销确认',
                    danger: true,
                    onClick: () => setAction({ entity: 'checkin', id: r.id, action: 'cancel' }),
                  },
                ]
              : []),
            ...(r.status === 'rejected' || (r.status === 'cancelled' && admin)
              ? [
                  {
                    key: 'restore',
                    label: '恢复签到',
                    onClick: () => setAction({ entity: 'checkin', id: r.id, action: 'restore' }),
                  },
                ]
              : []),
          ],
        }}
      >
        <Button type="text" aria-label={`${r.guestName} 签到#${r.id} 的更多操作`}>
          更多 ▾
        </Button>
      </Dropdown>
    </Space>
  );
}
