import { StatusTag } from '../components/StatusTag';
import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { GiftDTO, GiftMethod } from '@shared/types';
import { METHOD_LABEL, formatDateTime, yuan } from '@/lib/format';
import { RecordAction, RecordHistory } from '../components/RecordAction';
import { GiftEditor } from './GiftEditor.view';
import type { GiftsModel } from './useGiftsPage';
export function GiftsView({ model }: { model: GiftsModel }) {
  const {
    params,
    setParams,
    action,
    setAction,
    historyId,
    setHistoryId,
    list,
    isAdmin,
    openEdit,
    openCreate,
  } = model;
  const columns: ColumnsType<GiftDTO> = [
    {
      title: '姓名',
      dataIndex: 'guestName',
      width: 150,
      render: (v, r) => (
        <>
          {v}{' '}
          <small>
            #{r.id}
            {r.guestId != null ? ` · 宾客#${r.guestId}` : ''}
          </small>
        </>
      ),
    },
    {
      title: '状态',
      dataIndex: 'voidedAt',
      width: 90,
      render: (v) => (
        <StatusTag tone={v == null ? 'success' : 'inactive'}>
          {v == null ? '有效' : '已撤回（作废）'}
        </StatusTag>
      ),
    },
    { title: '金额（元）', dataIndex: 'amount', width: 120, render: (v: number) => yuan(v) },
    {
      title: '方式',
      dataIndex: 'method',
      width: 100,
      render: (v: GiftMethod) => <Tag>{METHOD_LABEL[v]}</Tag>,
    },
    { title: '备注', dataIndex: 'note', ellipsis: true, render: (v) => v ?? '-' },
    { title: '撤回时间', dataIndex: 'voidedAt', width: 170, render: formatDateTime },
    { title: '登记时间', dataIndex: 'recordedAt', width: 170, render: formatDateTime },
  ];

  if (isAdmin) {
    columns.push({
      title: '操作',
      width: 120,
      render: (_, r) => (
        <Space size="small">
          {r.voidedAt == null && <a onClick={() => openEdit(r)}>编辑</a>}
          <a
            onClick={() =>
              setAction({
                entity: 'gift',
                id: r.id,
                action: r.voidedAt == null ? 'void' : 'restore',
              })
            }
          >
            {r.voidedAt == null ? '作废' : '恢复'}
          </a>
          <a onClick={() => setHistoryId(r.id)}>操作记录</a>
        </Space>
      ),
    });
  }

  return (
    <div>
      <Typography.Title level={4}>礼金管理</Typography.Title>
      {action && (
        <RecordAction
          key={`${action.id}-${action.action}`}
          target={action}
          onClose={() => setAction(null)}
        />
      )}
      {historyId != null && (
        <RecordHistory entity="gift" id={historyId} onClose={() => setHistoryId(null)} />
      )}
      {isAdmin && list.data?.summary && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="有效礼金（当前筛选，元）" value={yuan(list.data.summary.total)} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="有效笔数" value={list.data.summary.count} />
            </Card>
          </Col>
          {list.data.summary.byMethod.map((m) => (
            <Col xs={12} md={6} key={m.method}>
              <Card>
                <Statistic title={`${METHOD_LABEL[m.method]}（元）`} value={yuan(m.amount)} />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Tabs
        activeKey={params.state ?? 'active'}
        items={[
          { key: 'active', label: '有效礼金' },
          { key: 'voided', label: '已撤回礼金' },
          { key: 'all', label: '全部礼金' },
        ]}
        onChange={(v) =>
          setParams((p) => ({
            page: 1,
            pageSize: p.pageSize,
            state: v === 'voided' ? 'voided' : v === 'all' ? 'all' : undefined,
          }))
        }
      />
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title={
          params.state === 'voided'
            ? '以下礼金已撤回（作废），保留原金额但不计入有效汇总。操作记录可查看原因和操作者；恢复后重新计入汇总。'
            : '礼金自愿，签到不要求赠送礼金。此处只登记实际收到的礼金；未登记礼金不代表欠款。'
        }
      />
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          key={`search-${params.state ?? 'active'}`}
          placeholder="姓名"
          allowClear
          style={{ width: 200 }}
          onSearch={(v) => setParams((p) => ({ ...p, keyword: v, page: 1 }))}
        />
        <Select
          value={params.method}
          placeholder="方式"
          allowClear
          style={{ width: 120 }}
          options={Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))}
          onChange={(v) => setParams((p) => ({ ...p, method: v, page: 1 }))}
        />
        {isAdmin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增礼金
          </Button>
        )}
      </Space>

      <Table
        locale={{
          emptyText: list.isError
            ? '加载失败，请刷新重试'
            : params.state === 'voided'
              ? '暂无已撤回礼金'
              : '暂无符合条件的礼金',
        }}
        rowKey="id"
        columns={columns}
        dataSource={list.data?.items ?? []}
        loading={list.isLoading}
        scroll={{ x: 1000 }}
        pagination={{
          current: params.page,
          pageSize: params.pageSize,
          total: list.data?.total ?? 0,
          onChange: (page, pageSize) => setParams((p) => ({ ...p, page, pageSize })),
        }}
      />

      <GiftEditor model={model} />
    </div>
  );
}
