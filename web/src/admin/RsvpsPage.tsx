import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Col, Form, Input, InputNumber, Modal, Row, Select, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { api, ApiError } from '@/api/client';
import type { Attending, RsvpDTO } from '@shared/types';
import { ATTENDING_COLOR, ATTENDING_LABEL, formatDateTime } from '@/lib/format';

export function RsvpsPage() {
  const qc = useQueryClient();
  const [params, setParams] = useState<{ page: number; pageSize: number; keyword?: string; attending?: Attending }>({
    page: 1,
    pageSize: 10,
  });
  const [editing, setEditing] = useState<RsvpDTO | null>(null);
  const [form] = Form.useForm();

  const list = useQuery({ queryKey: ['rsvps', params], queryFn: () => api.rsvps.list(params) });
  const s = list.data?.summary;

  const save = useMutation({
    mutationFn: (values: Partial<RsvpDTO>) => api.rsvps.update(editing!.id, values),
    onSuccess: () => {
      message.success('已保存');
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['rsvps'] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败'),
  });

  const columns: ColumnsType<RsvpDTO> = [
    { title: '姓名', dataIndex: 'guestName', width: 140 },
    {
      title: '是否出席',
      dataIndex: 'attending',
      width: 100,
      render: (v: Attending) => <Tag color={ATTENDING_COLOR[v]}>{ATTENDING_LABEL[v]}</Tag>,
    },
    { title: '出席人数', dataIndex: 'headcount', width: 90 },
    { title: '随行儿童', dataIndex: 'childrenCount', width: 90 },
    { title: '来源', dataIndex: 'source', width: 90, render: (v) => (v === 'link' ? '专属' : '通用') },
    { title: '留言', dataIndex: 'message', ellipsis: true, render: (v) => v ?? '-' },
    { title: '提交时间', dataIndex: 'submittedAt', width: 160, render: formatDateTime },
    {
      title: '操作',
      width: 80,
      render: (_, r) => (
        <a
          onClick={() => {
            setEditing(r);
            form.setFieldsValue(r);
          }}
        >
          修改
        </a>
      ),
    },
  ];

  return (
    <div>
      <Typography.Title level={4}>回执管理</Typography.Title>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card><Statistic title="出席" value={s?.yes ?? 0} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="不出席" value={s?.no ?? 0} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="待定" value={s?.maybe ?? 0} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="确认出席人数（含随行）" value={s?.headcountYes ?? 0} /></Card></Col>
      </Row>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="姓名"
          allowClear
          style={{ width: 200 }}
          onSearch={(v) => setParams((p) => ({ ...p, keyword: v, page: 1 }))}
        />
        <Select
          placeholder="出席状态"
          allowClear
          style={{ width: 140 }}
          options={Object.entries(ATTENDING_LABEL).map(([value, label]) => ({ value, label }))}
          onChange={(v) => setParams((p) => ({ ...p, attending: v, page: 1 }))}
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

      <Modal
        title="修改回执"
        open={editing != null}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Form.Item name="attending" label="是否出席">
            <Select options={Object.entries(ATTENDING_LABEL).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item name="headcount" label="出席人数">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="childrenCount" label="随行儿童">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="message" label="祝福留言">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
