import { StatusTag, type StatusTone } from '../components/StatusTag';
import { Alert, Form, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { RecordAction, RecordHistory } from '../components/RecordAction';
import { AttendanceFields } from '../components/AttendanceFields';
import type { CheckinDTO, CheckinStatus, GiftMethod } from '@shared/types';
import { CHECKIN_STATUS_LABEL, METHOD_LABEL, formatDateTime, yuan } from '@/lib/format';

import type { CheckinsModel } from './useCheckinsPage';
const checkinTone: Record<CheckinStatus, StatusTone> = {
  pending: 'pending',
  confirmed: 'success',
  rejected: 'error',
  cancelled: 'inactive',
};
export function CheckinsView({ model }: { model: CheckinsModel }) {
  const {
    editing,
    setEditing,
    form,
    correction,
    action,
    setAction,
    historyId,
    setHistoryId,
    me,
    params,
    setParams,
    list,
    openEdit,
  } = model;
  const columns: ColumnsType<CheckinDTO> = [
    {
      title: '姓名',
      dataIndex: 'guestName',
      width: 140,
      render: (v, r) => (
        <>
          {v} <small>#{r.id}</small>
        </>
      ),
    },
    {
      title: '实际总人数',
      dataIndex: 'actualHeadcount',
      width: 120,
      render: (v: number | null, r) =>
        v ?? (r.status === 'confirmed' || r.status === 'cancelled' ? '待补记' : '待核对'),
    },
    {
      title: '其中儿童',
      dataIndex: 'actualChildrenCount',
      width: 100,
      render: (v: number | null) => v ?? '-',
    },
    {
      title: '来源',
      dataIndex: 'source',
      width: 90,
      render: (v) => (v === 'self' ? '自助扫码' : '手动补录'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: CheckinStatus) => (
        <StatusTag tone={checkinTone[v]}>{CHECKIN_STATUS_LABEL[v]}</StatusTag>
      ),
    },
    {
      title: '礼金（元）',
      dataIndex: 'giftAmount',
      width: 110,
      render: (v: number | null, r) => (
        <>
          {v == null ? (r.status === 'confirmed' ? '未登记礼金' : '-') : yuan(v)}
          {r.giftVoided && <Tag>礼金已作废</Tag>}
        </>
      ),
    },
    {
      title: '方式',
      dataIndex: 'giftMethod',
      width: 90,
      render: (v: GiftMethod | null) => (v ? METHOD_LABEL[v] : '-'),
    },
    { title: '备注', dataIndex: 'note', ellipsis: true, render: (v) => v ?? '-' },
    { title: '提交时间', dataIndex: 'submittedAt', width: 160, render: formatDateTime },
    { title: '确认时间', dataIndex: 'confirmedAt', width: 160, render: formatDateTime },
    {
      title: '操作',
      width: 230,
      render: (_, r) => (
        <Space wrap>
          {r.status === 'confirmed' && me.data?.role === 'admin' && (
            <a onClick={() => openEdit(r)}>{r.actualHeadcount == null ? '补记人数' : '更正人数'}</a>
          )}
          {r.status === 'pending' && (
            <a onClick={() => setAction({ entity: 'checkin', id: r.id, action: 'reject' })}>驳回</a>
          )}
          {r.status === 'confirmed' && me.data?.role === 'admin' && (
            <a onClick={() => setAction({ entity: 'checkin', id: r.id, action: 'cancel' })}>
              撤销确认
            </a>
          )}
          {(r.status === 'rejected' || (r.status === 'cancelled' && me.data?.role === 'admin')) && (
            <a onClick={() => setAction({ entity: 'checkin', id: r.id, action: 'restore' })}>
              恢复
            </a>
          )}
          <a onClick={() => setHistoryId(r.id)}>操作记录</a>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Typography.Title level={4}>签到记录</Typography.Title>
      {action && (
        <RecordAction
          key={`${action.id}-${action.action}`}
          target={action}
          onClose={() => setAction(null)}
        />
      )}
      {historyId != null && (
        <RecordHistory entity="checkin" id={historyId} onClose={() => setHistoryId(null)} />
      )}
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="姓名"
          allowClear
          style={{ width: 200 }}
          onSearch={(v) => setParams((p) => ({ ...p, keyword: v, page: 1 }))}
        />
        <Select
          placeholder="状态"
          allowClear
          style={{ width: 140 }}
          options={Object.entries(CHECKIN_STATUS_LABEL).map(([value, label]) => ({ value, label }))}
          onChange={(v) => setParams((p) => ({ ...p, status: v, page: 1 }))}
        />
      </Space>
      <Modal
        open={editing != null}
        title={`${editing?.actualHeadcount == null ? '补记' : '更正'}到场人数 · ${editing?.guestName ?? ''} #${editing?.id ?? ''}`}
        onCancel={() => {
          if (!correction.isPending) setEditing(null);
        }}
        onOk={() => form.submit()}
        confirmLoading={correction.isPending}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title={`原记录：${editing?.actualHeadcount == null ? '人数待补记' : `${editing.actualHeadcount}人，其中儿童${editing.actualChildrenCount ?? 0}人`}。只调整到场人数，不改变回执、签到组数或礼金。`}
        />
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => correction.mutate(v)}
          disabled={correction.isPending}
        >
          <AttendanceFields />
          <Form.Item
            name="reason"
            label="补记或更正原因"
            rules={[
              { required: true, whitespace: true, max: 200, message: '请填写原因（最多200字）' },
            ]}
          >
            <Input.TextArea maxLength={200} rows={2} />
          </Form.Item>
        </Form>
      </Modal>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={list.data?.items ?? []}
        loading={list.isLoading}
        scroll={{ x: 1320 }}
        pagination={{
          current: params.page,
          pageSize: params.pageSize,
          total: list.data?.total ?? 0,
          onChange: (page, pageSize) => setParams((p) => ({ ...p, page, pageSize })),
        }}
      />
    </div>
  );
}
