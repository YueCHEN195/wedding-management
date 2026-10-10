import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Descriptions,
  Drawer,
  Form,
  Image,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import { DownloadOutlined, ImportOutlined, PlusOutlined, PictureOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api, ApiError, type GuestListParams } from '@/api/client';
import type { GuestDTO, GuestStatus, Side } from '@shared/types';
import { ATTENDING_COLOR, ATTENDING_LABEL, SIDE_LABEL, STATUS_COLOR, STATUS_LABEL, formatDateTime, yuan } from '@/lib/format';

export function GuestsPage() {
  const qc = useQueryClient();
  const [params, setParams] = useState<GuestListParams>({ page: 1, pageSize: 10 });
  const [editing, setEditing] = useState<GuestDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [qrGuest, setQrGuest] = useState<GuestDTO | null>(null);
  const [posterGuest, setPosterGuest] = useState<GuestDTO | null>(null);
  const [form] = Form.useForm();

  const list = useQuery({ queryKey: ['guests', params], queryFn: () => api.guests.list(params) });
  const groups = useQuery({ queryKey: ['guest-groups'], queryFn: api.guests.groups });
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  const isAdmin = me.data?.role === 'admin';
  const detail = useQuery({
    queryKey: ['guest-detail', detailId],
    queryFn: () => api.guests.detail(detailId!),
    enabled: detailId != null,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['guests'] });

  const save = useMutation({
    mutationFn: async (values: Partial<GuestDTO>) =>
      editing ? api.guests.update(editing.id, values) : api.guests.create(values),
    onSuccess: () => {
      message.success('已保存');
      setCreating(false);
      setEditing(null);
      invalidate();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败'),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.guests.remove(id),
    onSuccess: () => {
      message.success('已删除');
      invalidate();
    },
  });

  const markSent = useMutation({
    mutationFn: (id: number) => api.guests.markSent(id),
    onSuccess: () => {
      message.success('已标记为已发送');
      invalidate();
    },
  });

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setCreating(true);
  };
  const openEdit = (g: GuestDTO) => {
    setEditing(g);
    form.setFieldsValue(g);
    setCreating(true);
  };

  const copyLink = async (g: GuestDTO) => {
    try {
      await navigator.clipboard.writeText(g.inviteUrl);
      message.success('邀请链接已复制');
    } catch {
      Modal.info({ title: '邀请链接', content: g.inviteUrl });
    }
  };

  const columns: ColumnsType<GuestDTO> = [
    { title: '姓名', dataIndex: 'name', width: 110, render: (v, r) => (
      <a onClick={() => setDetailId(r.id)}>
        {v} {r.salutation ? <span style={{ color: '#999' }}>({r.salutation})</span> : null}
      </a>
    ) },
    { title: '手机号', dataIndex: 'phone', width: 130, render: (v) => v ?? '-' },
    { title: '分组', dataIndex: 'groupName', width: 90, render: (v) => v ?? '-' },
    { title: '归属', dataIndex: 'side', width: 80, render: (v: Side | null) => (v ? SIDE_LABEL[v] : '-') },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v: GuestStatus, r) => (
        <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v]}{r.attending ? ` · ${ATTENDING_LABEL[r.attending]}` : ''}</Tag>
      ),
    },
    { title: '备注', dataIndex: 'note', ellipsis: true, render: (v) => v ?? '-' },
    {
      title: '操作',
      width: 250,
      fixed: 'right',
      render: (_, r) => (
        <Space size="small" wrap>
          <a onClick={() => copyLink(r)}>复制链接</a>
          <a onClick={() => markSent.mutate(r.id)}>标记已发送</a>
          <a onClick={() => setQrGuest(r)}>二维码</a>
          <a onClick={() => setPosterGuest(r)}>海报</a>
          {isAdmin && <a onClick={() => openEdit(r)}>编辑</a>}
          {isAdmin && (
            <Popconfirm title="确认删除该宾客？" onConfirm={() => remove.mutate(r.id)}>
              <a style={{ color: '#cf1322' }}>删除</a>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="姓名 / 手机号"
          allowClear
          style={{ width: 200 }}
          onSearch={(v) => setParams((p) => ({ ...p, keyword: v, page: 1 }))}
        />
        <Select
          placeholder="状态"
          allowClear
          style={{ width: 120 }}
          options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
          onChange={(v) => setParams((p) => ({ ...p, status: v, page: 1 }))}
        />
        <Select
          placeholder="分组"
          allowClear
          style={{ width: 120 }}
          options={(groups.data ?? []).map((g) => ({ value: g, label: g }))}
          onChange={(v) => setParams((p) => ({ ...p, groupName: v, page: 1 }))}
        />
        <Select
          placeholder="归属方"
          allowClear
          style={{ width: 110 }}
          options={Object.entries(SIDE_LABEL).map(([value, label]) => ({ value, label }))}
          onChange={(v) => setParams((p) => ({ ...p, side: v, page: 1 }))}
        />
      </Space>

      <Space style={{ marginBottom: 16 }} wrap>
        {isAdmin && (
          <>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新增宾客
            </Button>
            <Upload
              accept=".xlsx,.xls"
              showUploadList={false}
              beforeUpload={async (file) => {
                try {
                  const r = await api.guests.import(file);
                  message.success(`导入成功 ${r.created} 条${r.failed.length ? `，失败 ${r.failed.length} 条` : ''}`);
                  invalidate();
                } catch (e) {
                  message.error(e instanceof ApiError ? e.message : '导入失败');
                }
                return false;
              }}
            >
              <Button icon={<ImportOutlined />}>导入 Excel</Button>
            </Upload>
            <Button icon={<DownloadOutlined />} href={api.guests.exportUrl()}>
              导出 Excel
            </Button>
            <Button icon={<PictureOutlined />} href={api.guests.postersZipUrl()}>
              批量海报 ZIP
            </Button>
            <Typography.Text type="secondary">共 {list.data?.total ?? 0} 位宾客</Typography.Text>
          </>
        )}
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={list.data?.items ?? []}
        loading={list.isLoading}
        scroll={{ x: 1100 }}
        pagination={{
          current: params.page,
          pageSize: params.pageSize,
          total: list.data?.total ?? 0,
          showSizeChanger: true,
          onChange: (page, pageSize) => setParams((p) => ({ ...p, page, pageSize })),
        }}
      />

      <Modal
        title={editing ? '编辑宾客' : '新增宾客'}
        open={creating}
        onCancel={() => setCreating(false)}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => save.mutate(v)}
          initialValues={{ side: 'both' }}
        >
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="salutation" label="称谓（用于请柬称呼）">
            <Input placeholder="如：张先生" />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input />
          </Form.Item>
          <Form.Item name="groupName" label="分组">
            <Input placeholder="如：朋友 / 同事 / 亲戚" />
          </Form.Item>
          <Form.Item name="side" label="归属方">
            <Select options={Object.entries(SIDE_LABEL).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer title="宾客详情" width={520} open={detailId != null} onClose={() => setDetailId(null)}>
        {detail.data && (
          <div>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="姓名">{detail.data.guest.name}</Descriptions.Item>
              <Descriptions.Item label="称谓">{detail.data.guest.salutation ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="手机号">{detail.data.guest.phone ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_COLOR[detail.data.guest.status]}>{STATUS_LABEL[detail.data.guest.status]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="邀请链接">
                <a onClick={() => copyLink(detail.data!.guest)}>复制</a>
              </Descriptions.Item>
            </Descriptions>
            <Typography.Title level={5} style={{ marginTop: 16 }}>回执</Typography.Title>
            {detail.data.rsvp ? (
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="是否出席">{ATTENDING_LABEL[detail.data.rsvp.attending]}</Descriptions.Item>
                <Descriptions.Item label="出席人数">{detail.data.rsvp.headcount}</Descriptions.Item>
                <Descriptions.Item label="随行儿童">{detail.data.rsvp.childrenCount}</Descriptions.Item>
                <Descriptions.Item label="祝福留言">{detail.data.rsvp.message ?? '-'}</Descriptions.Item>
              </Descriptions>
            ) : (
              <Typography.Text type="secondary">暂无回执</Typography.Text>
            )}
            <Typography.Title level={5} style={{ marginTop: 16 }}>签到（{detail.data.checkins.length}）</Typography.Title>
            {detail.data.checkins.map((c) => (
              <div key={c.id}>
                {formatDateTime(c.submittedAt)} · {c.status === 'confirmed' ? '已确认' : '待审核'}
              </div>
            ))}
            <Typography.Title level={5} style={{ marginTop: 16 }}>
              礼金（合计 ¥{yuan(detail.data.giftTotal)}）
            </Typography.Title>
            {detail.data.gifts.map((g) => (
              <div key={g.id}>{formatDateTime(g.recordedAt)} · ¥{yuan(g.amount)} · {g.method}</div>
            ))}
          </div>
        )}
      </Drawer>

      <Modal open={qrGuest != null} title={`二维码 · ${qrGuest?.name ?? ''}`} footer={null} onCancel={() => setQrGuest(null)}>
        {qrGuest && <Image src={api.guests.qrUrl(qrGuest.id)} width={260} />}
        <div style={{ marginTop: 8 }}>
          <Typography.Text copyable={{ text: qrGuest?.inviteUrl }}>{qrGuest?.inviteUrl}</Typography.Text>
        </div>
      </Modal>

      <Modal open={posterGuest != null} title={`海报 · ${posterGuest?.name ?? ''}`} footer={null} width={420} onCancel={() => setPosterGuest(null)}>
        {posterGuest && (
          <>
            <Image src={api.guests.posterUrl(posterGuest.id)} width="100%" />
            <Button style={{ marginTop: 8 }} icon={<DownloadOutlined />} href={api.guests.posterUrl(posterGuest.id)}>
              下载海报
            </Button>
          </>
        )}
      </Modal>
    </div>
  );
}
