import { Button, Empty, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Attending, RsvpDTO, RsvpSource } from '@shared/types';
import { ATTENDING_LABEL, formatDateTime } from '@/lib/format';
import { StatusTag, type StatusTone } from '../components/StatusTag';
import { TableText } from '../components/TableText';
import type { RsvpsModel } from './useRsvpsPage';
// At 1440px, all columns fit the shell; narrower windows scroll only inside the native table.
const TABLE_WIDTH = 1200;
const attendanceTone: Record<Attending, StatusTone> = {
  yes: 'success',
  no: 'neutral',
  maybe: 'pending',
};
const sourceLabel: Record<RsvpSource, string> = { link: '专属请柬', universal: '通用请柬' };
export function RsvpTable({ model }: { model: RsvpsModel }) {
  const { params, setParams, list, openEdit } = model;
  const columns: ColumnsType<RsvpDTO> = [
    {
      title: '姓名 / 回执编号',
      width: 190,
      fixed: 'left',
      render: (_, r) => (
        <div className="rsvp-identity">
          <span className="rsvp-id">{r.guestId == null ? '未关联' : `#${r.guestId}`}</span>
          <TableText value={r.guestName} />
          <span className="rsvp-id">回执 #{r.id}</span>
        </div>
      ),
    },
    {
      title: '是否出席',
      width: 100,
      dataIndex: 'attending',
      render: (v: Attending) => (
        <StatusTag tone={attendanceTone[v]}>{ATTENDING_LABEL[v]}</StatusTag>
      ),
    },
    {
      title: '预计总人数',
      width: 100,
      align: 'right',
      dataIndex: 'headcount',
      render: (v: number | null) => (v == null ? '未记录' : v),
    },
    {
      title: '其中儿童',
      width: 90,
      align: 'right',
      dataIndex: 'childrenCount',
      render: (v: number | null) => (v == null ? '未记录' : v),
    },
    {
      title: '关联宾客',
      width: 90,
      render: (_, r) => (r.guestId == null ? '未关联' : `#${r.guestId}`),
    },
    {
      title: '档案状态',
      width: 100,
      render: (_, r) =>
        r.guestId == null ? (
          '—'
        ) : (
          <StatusTag tone={r.guestArchived ? 'inactive' : 'neutral'}>
            {r.guestArchived ? '已归档' : '当前宾客'}
          </StatusTag>
        ),
    },
    { title: '来源', width: 100, dataIndex: 'source', render: (v: RsvpSource) => sourceLabel[v] },
    {
      title: '祝福留言',
      dataIndex: 'message',
      ellipsis: { showTitle: false },
      render: (v: string | null) => <TableText value={v} />,
    },
    { title: '提交时间', dataIndex: 'submittedAt', width: 160, render: formatDateTime },
    {
      title: '操作',
      align: 'right',
      width: 90,
      fixed: 'right',
      render: (_, r) => (
        <Tooltip title={r.guestArchived ? '宾客已归档，请先在宾客管理中恢复' : undefined}>
          <span>
            <Button type="link" disabled={r.guestArchived} onClick={() => openEdit(r)}>
              修改
            </Button>
          </span>
        </Tooltip>
      ),
    },
  ];
  return (
    <Table<RsvpDTO>
      className="rsvp-table"
      size="small"
      rowKey="id"
      columns={columns}
      dataSource={list.data?.items ?? []}
      loading={list.isPending}
      scroll={{ x: TABLE_WIDTH }}
      locale={{
        emptyText: (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              list.isError
                ? '连接失败，暂时无法获取回执'
                : params.keyword || params.attending
                  ? '没有符合条件的回执'
                  : '还没有收到回执'
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
          setParams((current) => ({
            ...current,
            page: current.pageSize !== pageSize ? 1 : page,
            pageSize,
          })),
      }}
    />
  );
}
