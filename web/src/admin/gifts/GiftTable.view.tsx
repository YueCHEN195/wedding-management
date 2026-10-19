import { Button, Dropdown, Empty, Space, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { GiftDTO, GiftMethod } from '@shared/types';
import { METHOD_LABEL, formatDateTime, yuan } from '@/lib/format';
import { StatusTag } from '../components/StatusTag';
import { TableText } from '../components/TableText';
import type { GiftsModel } from './useGiftsPage';
// Column budget keeps notes readable; horizontal scroll belongs to the native table.
const TABLE_WIDTH = { active: 1200, history: 1360 };
export function GiftTable({ model }: { model: GiftsModel }) {
  const { params, setParams, list } = model;
  return (
    <Table<GiftDTO>
      className="gift-table"
      size="small"
      rowKey="id"
      columns={giftColumns(model)}
      dataSource={list.data?.items ?? []}
      loading={list.isPending}
      scroll={{ x: params.state ? TABLE_WIDTH.history : TABLE_WIDTH.active }}
      locale={{
        emptyText: (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              list.isError
                ? '连接失败，暂时无法获取账目'
                : params.keyword || params.method
                  ? '没有符合条件的礼金记录'
                  : params.state === 'voided'
                    ? '还没有已作废礼金'
                    : '还没有礼金记录'
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

function giftColumns(model: GiftsModel): ColumnsType<GiftDTO> {
  const { params, isAdmin, openEdit, setAction, setHistoryId } = model;
  return [
    {
      title: '姓名 / 礼金编号',
      width: 200,
      fixed: 'left',
      render: (_, r) => (
        <div className="gift-identity">
          <TableText value={r.guestName} />
          <span className="gift-id">#{r.id}</span>
        </div>
      ),
    },
    {
      title: '关联宾客',
      width: 100,
      render: (_, r) => (r.guestId == null ? '未关联' : `#${r.guestId}`),
    },
    {
      title: '金额（元）',
      width: 140,
      align: 'right',
      render: (_, r) => (
        <span className={`gift-amount${r.voidedAt != null ? ' gift-amount-voided' : ''}`}>
          ¥{yuan(r.amount)}
        </span>
      ),
    },
    { title: '方式', dataIndex: 'method', width: 90, render: (v: GiftMethod) => METHOD_LABEL[v] },
    {
      title: '状态',
      width: 110,
      render: (_, r) => (
        <Tooltip title={r.voidedAt == null ? '计入有效汇总' : '保留原金额，不计入有效汇总'}>
          <span>
            <StatusTag tone={r.voidedAt == null ? 'success' : 'inactive'}>
              {r.voidedAt == null ? '有效' : '已作废'}
            </StatusTag>
          </span>
        </Tooltip>
      ),
    },
    {
      title: '备注',
      dataIndex: 'note',
      ellipsis: { showTitle: false },
      render: (v: string | null) => <TableText value={v} />,
    },
    { title: '登记时间', dataIndex: 'recordedAt', width: 160, render: formatDateTime },
    ...(params.state
      ? [{ title: '作废时间', dataIndex: 'voidedAt', width: 160, render: formatDateTime }]
      : []),
    ...(isAdmin
      ? [
          {
            title: '操作',
            align: 'right' as const,
            width: 150,
            fixed: 'right' as const,
            render: (_: unknown, r: GiftDTO) => (
              <Space size="small">
                {r.voidedAt == null && (
                  <Button type="link" onClick={() => openEdit(r)}>
                    更正
                  </Button>
                )}
                <Dropdown
                  trigger={['click']}
                  menu={{
                    items: [
                      { key: 'history', label: '操作记录', onClick: () => setHistoryId(r.id) },
                      {
                        key: 'state',
                        label: r.voidedAt == null ? '作废礼金' : '恢复礼金',
                        danger: r.voidedAt == null,
                        onClick: () =>
                          setAction({
                            entity: 'gift',
                            id: r.id,
                            action: r.voidedAt == null ? 'void' : 'restore',
                          }),
                      },
                    ],
                  }}
                >
                  <Button type="text" aria-label={`${r.guestName} 礼金#${r.id} 的更多操作`}>
                    更多 ▾
                  </Button>
                </Dropdown>
              </Space>
            ),
          },
        ]
      : []),
  ];
}
