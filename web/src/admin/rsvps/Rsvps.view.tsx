import {
  Card,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { parseHeadcount } from '@shared/numericInput';
import { MAX_HEADCOUNT, MAX_TEXT_LENGTH } from '@shared/constraints';
import type { Attending, RsvpDTO } from '@shared/types';
import { ATTENDING_COLOR, ATTENDING_LABEL, formatDateTime } from '@/lib/format';

import type { RsvpsModel } from './useRsvpsPage';
export function RsvpsView({ model }: { model: RsvpsModel }) {
  const { params, setParams, editing, setEditing, form, attending, list, s, save, openEdit } =
    model;
  const columns: ColumnsType<RsvpDTO> = [
    {
      title: '姓名',
      dataIndex: 'guestName',
      width: 140,
      render: (v, r) => (
        <>
          {v}
          {r.guestArchived && <Tag>宾客已归档</Tag>}
        </>
      ),
    },
    {
      title: '是否出席',
      dataIndex: 'attending',
      width: 100,
      render: (v: Attending) => <Tag color={ATTENDING_COLOR[v]}>{ATTENDING_LABEL[v]}</Tag>,
    },
    { title: '出席人数', dataIndex: 'headcount', width: 90 },
    { title: '随行儿童', dataIndex: 'childrenCount', width: 90 },
    {
      title: '来源',
      dataIndex: 'source',
      width: 150,
      render: (v, r) => (
        <>
          {v === 'link' ? '专属' : '通用'}
          {r.guestId == null && <Tag style={{ marginLeft: 6 }}>待关联宾客</Tag>}
        </>
      ),
    },
    { title: '留言', dataIndex: 'message', ellipsis: true, render: (v) => v ?? '-' },
    { title: '提交时间', dataIndex: 'submittedAt', width: 160, render: formatDateTime },
    {
      title: '操作',
      width: 80,
      render: (_, r) => (
        <a
          aria-disabled={r.guestArchived}
          style={r.guestArchived ? { color: '#999', pointerEvents: 'none' } : undefined}
          onClick={() => openEdit(r)}
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
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="出席" value={s?.yes ?? 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="不出席" value={s?.no ?? 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="待定" value={s?.maybe ?? 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="确认出席人数（含随行）" value={s?.headcountYes ?? 0} />
          </Card>
        </Col>
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
          <Form.Item
            name="attending"
            label="是否出席"
            rules={[{ required: true, message: '请选择出席状态' }]}
          >
            <Select
              options={Object.entries(ATTENDING_LABEL).map(([value, label]) => ({ value, label }))}
              onChange={(v) => {
                if (v !== 'yes') form.setFieldsValue({ headcount: '0', childrenCount: '0' });
                else if (!Number(form.getFieldValue('headcount')))
                  form.setFieldValue('headcount', '1');
              }}
            />
          </Form.Item>
          <Typography.Paragraph type="secondary">
            总人数包含儿童，最多{MAX_HEADCOUNT}人；不出席和待定均按0人保存。
          </Typography.Paragraph>
          <Form.Item
            name="headcount"
            label="出席总人数（含儿童）"
            dependencies={['attending']}
            rules={[
              { required: true, message: '请填写总人数' },
              ({ getFieldValue }) => ({
                validator: (_, v) =>
                  parseHeadcount(v) != null &&
                  parseHeadcount(v)! >= (getFieldValue('attending') === 'yes' ? 1 : 0)
                    ? Promise.resolve()
                    : Promise.reject(
                        new Error(
                          `请填写${getFieldValue('attending') === 'yes' ? '1' : '0'}–${MAX_HEADCOUNT}的整数`,
                        ),
                      ),
              }),
            ]}
          >
            <Input
              inputMode="numeric"
              maxLength={3}
              disabled={attending !== 'yes'}
              placeholder="1–20"
            />
          </Form.Item>
          <Form.Item
            name="childrenCount"
            label="其中儿童人数"
            dependencies={['headcount', 'attending']}
            rules={[
              { required: true, message: '请填写儿童人数，没有填0' },
              ({ getFieldValue }) => ({
                validator: (_, v) =>
                  parseHeadcount(v) != null &&
                  (getFieldValue('attending') !== 'yes' ||
                    (parseHeadcount(getFieldValue('headcount')) != null &&
                      parseHeadcount(v)! <= parseHeadcount(getFieldValue('headcount'))!))
                    ? Promise.resolve()
                    : Promise.reject(new Error('儿童人数须为整数，且不能超过总人数')),
              }),
            ]}
          >
            <Input
              inputMode="numeric"
              maxLength={3}
              disabled={attending !== 'yes'}
              placeholder="没有儿童填0"
            />
          </Form.Item>
          <Form.Item
            name="message"
            label="祝福留言"
            rules={[{ max: MAX_TEXT_LENGTH, message: `留言最多${MAX_TEXT_LENGTH}字` }]}
          >
            <Input.TextArea rows={3} maxLength={MAX_TEXT_LENGTH} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
