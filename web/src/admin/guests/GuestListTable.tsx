import { Button, Dropdown, Empty, Space, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { GuestDTO, GuestStatus, Side } from '@shared/types';
import { ATTENDING_LABEL, SIDE_LABEL, STATUS_LABEL, formatDateTime } from '@/lib/format';
import { TableText } from '../components/TableText';
import { guestMenu } from './guestMenu';
import type { GuestManagementModel } from './useGuestManagement';
// Reserve readable notes after separating attendance and invitation status.
const TABLE_WIDTH = { current: 1160, history: 1320 };
const invitationTone: Record<GuestStatus, string> = {
  pending: 'default',
  sent: 'processing',
  viewed: 'processing',
  rsvp: 'success',
};
type Props = Pick<
  GuestManagementModel,
  | 'params'
  | 'list'
  | 'filtered'
  | 'setParams'
  | 'openView'
  | 'openEdit'
  | 'markSent'
  | 'setMedia'
  | 'setHistoryId'
  | 'setAction'
>;
export function GuestListTable({ model }: { model: Props }) {
  const { params, list, filtered, setParams, openView, openEdit } = model;
  const rowMenu = (guest: GuestDTO) => guestMenu(guest, model);
  const columns: ColumnsType<GuestDTO> = [
    {
      title: '宾客',
      width: 180,
      fixed: 'left',
      render: (_, g) => (
        <div className="guest-name-cell">
          <Tooltip
            title={[g.name, g.salutation].filter(Boolean).join(' · ')}
            trigger={['hover', 'focus']}
          >
            <Button type="link" onClick={() => openView(g.id)}>
              <span className="guest-name-label">{g.name}</span>
            </Button>
          </Tooltip>
          <span className="guest-muted">#{g.id}</span>
        </div>
      ),
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      width: 140,
      ellipsis: { showTitle: false },
      render: (v) => <TableText value={v} />,
    },
    {
      title: '分组',
      dataIndex: 'groupName',
      width: 130,
      ellipsis: { showTitle: false },
      render: (v) => <TableText value={v} />,
    },
    {
      title: '归属',
      dataIndex: 'side',
      width: 80,
      render: (v: Side | null) => (v ? SIDE_LABEL[v] : '—'),
    },
    {
      title: '邀请 / 回执',
      width: 120,
      render: (_, g) => (
        <Tag variant="filled" color={g.archivedAt ? 'default' : invitationTone[g.status]}>
          {g.archivedAt ? '已归档' : STATUS_LABEL[g.status]}
        </Tag>
      ),
    },
    {
      title: '是否出席',
      width: 100,
      render: (_, g) => (g.attending ? ATTENDING_LABEL[g.attending] : '未填回执'),
    },
    ...(params.archived
      ? [{ title: '归档时间', dataIndex: 'archivedAt', width: 160, render: formatDateTime }]
      : []),
    {
      title: '备注',
      dataIndex: 'note',
      ellipsis: { showTitle: false },
      render: (v) => <TableText value={v} />,
    },
    {
      title: '操作',
      width: 144,
      fixed: 'right',
      render: (_, g) => (
        <Space size="small">
          {g.archivedAt == null && (
            <Button
              type="link"
              onClick={() => {
                void openEdit(g.id);
              }}
            >
              编辑
            </Button>
          )}
          <Dropdown trigger={['click']} menu={{ items: rowMenu(g) }}>
            <Button type="text" aria-label={`${g.name} #${g.id} 的更多操作`}>
              更多 ▾
            </Button>
          </Dropdown>
        </Space>
      ),
    },
  ];

  return (
    <Table<GuestDTO>
      className="guest-list-table"
      rowKey="id"
      columns={columns}
      dataSource={list.data?.items ?? []}
      loading={list.isPending}
      size="small"
      scroll={{ x: params.archived ? TABLE_WIDTH.history : TABLE_WIDTH.current }}
      locale={{
        emptyText: (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              list.isError
                ? '连接失败，暂时无法获取名单'
                : filtered
                  ? '没有符合条件的宾客'
                  : params.archived === 'only'
                    ? '还没有已归档宾客'
                    : '还没有宾客档案'
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
