import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { api } from '@/api/client';
import type { CheckinDTO, CheckinStatus, GiftMethod } from '@shared/types';
import { CHECKIN_STATUS_LABEL, METHOD_LABEL, formatDateTime, yuan } from '@/lib/format';

export function CheckinsPage() {
  const [params, setParams] = useState<{ page: number; pageSize: number; status?: CheckinStatus; keyword?: string }>({
    page: 1,
    pageSize: 10,
  });
  const list = useQuery({ queryKey: ['checkins', params], queryFn: () => api.checkins.list(params) });

  const columns: ColumnsType<CheckinDTO> = [
    { title: '姓名', dataIndex: 'guestName', width: 140 },
    { title: '来源', dataIndex: 'source', width: 90, render: (v) => (v === 'self' ? '自助扫码' : '手动补录') },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: CheckinStatus) => <Tag color={v === 'confirmed' ? 'green' : 'orange'}>{CHECKIN_STATUS_LABEL[v]}</Tag>,
    },
    {
      title: '礼金（元）',
      dataIndex: 'giftAmount',
      width: 110,
      render: (v: number | null) => (v == null ? '-' : yuan(v)),
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
  ];

  return (
    <div>
      <Typography.Title level={4}>签到记录</Typography.Title>
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
      <Table
        rowKey="id"
        columns={columns}
        dataSource={list.data?.items ?? []}
        loading={list.isLoading}
        scroll={{ x: 900 }}
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
