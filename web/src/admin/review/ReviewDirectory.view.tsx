import { RefreshButton } from '../components/RefreshButton';
import { StatusTag } from '../components/StatusTag';
import '../components/filter-bar.css';
import { Alert, Button, Empty, Input, Select, Tabs, Tooltip } from 'antd';
import { TableText } from '../components/TableText';
import { ViewportTable } from '../components/ViewportTable';
import type { ColumnsType } from 'antd/es/table';
import type { ReviewGuestRow, ReviewGuestStatus } from '@shared/types';
import { formatDateTime, SIDE_LABEL, yuan } from '@/lib/format';
import type { ReviewDirectoryModel, ReviewDirectoryProps } from './useReviewDirectory';
import { ReviewGuestDrawer } from './ReviewGuestDrawer.view';
import { reviewStatusLabels as labels } from './reviewStatusLabels';
export function ReviewDirectoryView({
  model,
  ...props
}: ReviewDirectoryProps & { model: ReviewDirectoryModel }) {
  const { admin, selectedId } = props;
  const {
    keyword,
    searchPending,
    setKeyword,
    status,
    setStatus,
    side,
    setSide,
    page,
    setPage,
    advanced,
    setAdvanced,
    query,
  } = model;
  const columns = reviewDirectoryColumns(model, props);
  return (
    <section className="review-directory" aria-label="全部宾客查询">
      <Tabs
        tabBarExtraContent={
          <RefreshButton
            compact
            loading={query.isFetching}
            onRefresh={() => {
              void query.refetch();
            }}
          />
        }
        activeKey={status ?? 'all'}
        onChange={(v) => {
          setStatus(v === 'all' ? undefined : (v as ReviewGuestStatus));
          setPage(1);
        }}
        items={[
          { key: 'all', label: '全部宾客' },
          { key: 'pending', label: '待审核' },
          { key: 'confirmed', label: '已签到' },
          { key: 'unconfirmed', label: '未签到' },
        ]}
      />
      <div className="admin-filter-row review-filterbar">
        <Input.Search
          autoComplete="off"
          aria-label="搜索姓名或分组"
          placeholder="搜索姓名 / 分组"
          allowClear
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setPage(1);
          }}
        />
        <Button type="text" onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}>
          归属筛选 {advanced ? '−' : '+'}
        </Button>
        <Button
          type="text"
          onClick={() => {
            setKeyword('');
            setStatus(undefined);
            setSide(undefined);
            setPage(1);
          }}
        >
          重置
        </Button>
        <span className="review-connection">
          {searchPending
            ? '等待搜索输入完成…'
            : query.data
              ? `当前筛选 ${query.data.total} 条`
              : '正在读取名单'}
        </span>
      </div>
      {advanced && (
        <div className="admin-filter-row review-filterbar">
          <Select
            aria-label="归属方"
            allowClear
            placeholder="全部归属"
            value={side}
            onChange={(v) => {
              setSide(v);
              setPage(1);
            }}
            options={Object.entries(SIDE_LABEL).map(([value, label]) => ({ value, label }))}
          />
        </div>
      )}
      {!searchPending && query.isError && (
        <Alert
          type="error"
          showIcon
          title={query.data ? '名单刷新失败，以下为上次数据' : '宾客名单加载失败'}
          action={<Button onClick={() => query.refetch()}>重试</Button>}
        />
      )}
      <ViewportTable<ReviewGuestRow>
        rowKey="key"
        size="small"
        columns={columns}
        dataSource={searchPending ? [] : (query.data?.items ?? [])}
        loading={searchPending || query.isPending}
        rowClassName={(r) =>
          r.pendingId != null && r.pendingId === selectedId ? 'review-selected-row' : ''
        }
        empty={<DirectoryEmpty model={model} />}
        scrollX={admin ? 1104 : 864}
        pagination={{
          current: page,
          pageSize: 10,
          total: query.data?.total,
          showSizeChanger: false,
          showTotal: query.data ? (total) => `${total} 条` : undefined,
          onChange: setPage,
        }}
      />
      <p className="review-connection">
        预计人数来自最新出席回执；实到包含儿童。未匹配提交独立展示，核对后再关联档案。
      </p>
      <ReviewGuestDrawer {...props} model={model} />
    </section>
  );
}

function reviewDirectoryColumns(
  model: ReviewDirectoryModel,
  { admin, disabled, onProcess }: ReviewDirectoryProps,
): ColumnsType<ReviewGuestRow> {
  const { setSelected } = model;
  return [
    {
      title: '姓名',
      width: 120,
      fixed: 'left',
      render: (_, r) => (
        <Tooltip title={r.name} trigger={['hover', 'focus']}>
          <Button className="review-directory-name" type="link" onClick={() => setSelected(r)}>
            <span>
              {r.guestId == null ? '未关联' : `#${r.guestId}`} · {r.name}
            </span>
          </Button>
        </Tooltip>
      ),
    },
    {
      title: '分组 / 归属',
      width: 145,
      ellipsis: { showTitle: false },
      render: (_, r) =>
        r.guestId == null ? (
          '未匹配档案'
        ) : (
          <TableText
            value={[r.groupName, r.side && SIDE_LABEL[r.side]].filter(Boolean).join(' · ')}
          />
        ),
    },
    {
      title: '预计',
      dataIndex: 'expected',
      width: 64,
      align: 'right',
      render: (v) => (v == null ? '—' : `${v}人`),
    },
    {
      title: '实到',
      dataIndex: 'actual',
      width: 88,
      align: 'right',
      render: (v, r) => (v == null ? (r.status === 'confirmed' ? '待补记' : '—') : `${v}人`),
    },
    {
      title: '签到状态',
      width: 102,
      render: (_, r) => (
        <StatusTag
          tone={
            r.status === 'confirmed' ? 'success' : r.status === 'pending' ? 'pending' : 'neutral'
          }
        >
          {labels[r.status]}
        </StatusTag>
      ),
    },
    ...(admin
      ? [
          {
            title: '有效礼金',
            width: 110,
            align: 'right' as const,
            render: (_: unknown, r: ReviewGuestRow) =>
              r.giftTotal == null ? '未登记' : `¥${yuan(r.giftTotal)}`,
          },
        ]
      : []),
    { title: '提交 / 签到', width: 145, render: (_, r) => (r.time ? formatDateTime(r.time) : '—') },
    ...(admin
      ? [
          {
            title: '备注',
            dataIndex: 'note',
            width: 130,
            ellipsis: { showTitle: false },
            render: (v: string | null) => <TableText value={v} />,
          },
        ]
      : []),
    {
      title: '操作',
      align: 'right',
      width: 100,
      fixed: 'right',
      render: (_, r) => (
        <Button
          type="link"
          disabled={disabled}
          onClick={() => (r.status === 'confirmed' ? setSelected(r) : onProcess(r))}
        >
          {r.status === 'confirmed' ? '查看记录' : '核对签到'}
        </Button>
      ),
    },
  ];
}

function DirectoryEmpty({
  model: { query, keyword, side, status },
}: {
  model: ReviewDirectoryModel;
}) {
  if (query.isError)
    return (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="连接失败，不能判断名单是否为空" />
    );
  if (keyword || side)
    return (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的宾客">
        <p className="review-connection">试试其他姓名，或重置筛选。</p>
      </Empty>
    );
  const messages = {
    confirmed: ['还没有已签到宾客', '现场确认到场后，宾客和实到人数会显示在这里。'],
    pending: ['当前没有待审核宾客', '新的扫码提交会实时出现在左侧队列。'],
    unconfirmed: ['当前没有未签到宾客', '可通过「查人 / 手动补录」登记现场来宾。'],
    all: ['还没有宾客档案或待审核提交', '可通过「查人 / 手动补录」登记现场来宾。'],
  };
  const [title, description] = messages[status ?? 'all'];
  return (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={title}>
      <p className="review-connection">{description}</p>
    </Empty>
  );
}
