import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Form,
  Image,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tabs,
  Typography,
  Upload,
  message,
} from 'antd';
import { DownloadOutlined, ImportOutlined, PlusOutlined, PictureOutlined } from '@ant-design/icons';
import { MAX_GROUP_LENGTH, MAX_NAME_LENGTH, MAX_TEXT_LENGTH } from '@shared/constraints';
import type { ColumnsType } from 'antd/es/table';
import { RecordAction, RecordHistory, type RecordActionTarget } from './components/RecordAction';
import { api, ApiError, type GuestListParams } from '@/api/client';
import type { GuestDTO, GuestStatus, Side } from '@shared/types';
import { ATTENDING_COLOR, ATTENDING_LABEL, SIDE_LABEL, STATUS_COLOR, STATUS_LABEL, formatDateTime, yuan } from '@/lib/format';

export function GuestsPage() {
  const qc = useQueryClient();
  const [params, setParams] = useState<GuestListParams>({ page: 1, pageSize: 10 });
  const [action, setAction] = useState<RecordActionTarget | null>(null);
  const [historyId, setHistoryId] = useState<number | null>(null);
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

  const invalidate = () => {
    for (const key of ['guests', 'guest-groups', 'guest-detail', 'rsvps', 'checkins', 'checkin-candidates', 'gifts', 'stats']) {
      qc.invalidateQueries({ queryKey: [key] });
    }
  };

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

  const markSent = useMutation({
    mutationFn: (id: number) => api.guests.markSent(id),
    onSuccess: () => {
      message.success('已记录发送');
      invalidate();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '标记失败，请重试'),
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
        {v} <small>#{r.id}</small> {r.salutation ? <span style={{ color: '#999' }}>({r.salutation})</span> : null}
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
        <Tag color={r.archivedAt != null ? 'default' : STATUS_COLOR[v]}>{r.archivedAt != null ? '已归档' : STATUS_LABEL[v]}{r.attending ? ` · ${ATTENDING_LABEL[r.attending]}` : ''}</Tag>
      ),
    },
    { title: '归档时间', dataIndex: 'archivedAt', width: 170, render: formatDateTime },
    { title: '备注', dataIndex: 'note', ellipsis: true, render: (v) => v ?? '-' },
    {
      title: '操作',
      width: 250,
      fixed: 'right',
      render: (_, r) => (
        <Space size="small" wrap>
          {r.archivedAt == null && <>
            {isAdmin && <a href={`/invite/${encodeURIComponent(r.inviteToken)}`} target="_blank" rel="noopener noreferrer">预览请柬</a>}
            <a onClick={() => copyLink(r)}>复制链接</a>
            {isAdmin && <a onClick={() => markSent.mutate(r.id)}>标记已发送</a>}
            <a onClick={() => setQrGuest(r)}>二维码</a>
            <a onClick={() => setPosterGuest(r)}>海报</a>
            {isAdmin && <a onClick={() => openEdit(r)}>编辑</a>}
          </>}
          {isAdmin && <>
            <a onClick={() => setAction({ entity: 'guest', id: r.id, action: r.archivedAt == null ? 'archive' : 'restore' })}>{r.archivedAt == null ? '归档' : '恢复'}</a>
            <a onClick={() => setHistoryId(r.id)}>操作记录</a>
          </>}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {action && <RecordAction key={`${action.id}-${action.action}`} target={action} onClose={() => { setAction(null); setDetailId(null); }} />}
      {historyId != null && <RecordHistory entity="guest" id={historyId} onClose={() => setHistoryId(null)} />}
      <Typography.Title level={4}>宾客管理</Typography.Title>
      <Tabs activeKey={params.archived ?? 'active'} items={[{ key: 'active', label: '当前宾客' }, { key: 'only', label: '已归档宾客' }, { key: 'all', label: '全部宾客' }]}
        onChange={(v) => setParams((p) => ({ page: 1, pageSize: p.pageSize, archived: v === 'only' ? 'only' : v === 'all' ? 'all' : undefined }))} />
      {params.archived && <Alert type="info" showIcon style={{ marginBottom: 16 }} title="归档保留回执、签到和礼金记录。点击姓名查看详情，点击操作记录查看原因和操作者；恢复前仍需核对影响。" />}
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          key={`search-${params.archived ?? 'active'}`}
          placeholder="姓名 / 手机号"
          allowClear
          style={{ width: 200 }}
          onSearch={(v) => setParams((p) => ({ ...p, keyword: v, page: 1 }))}
        />
        <Select
          value={params.status}
          placeholder="状态"
          allowClear
          style={{ width: 120 }}
          options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
          onChange={(v) => setParams((p) => ({ ...p, status: v, page: 1 }))}
        />
        <Select
          value={params.groupName}
          placeholder="分组"
          allowClear
          style={{ width: 120 }}
          options={(groups.data ?? []).map((g) => ({ value: g, label: g }))}
          onChange={(v) => setParams((p) => ({ ...p, groupName: v, page: 1 }))}
        />
        <Select
          value={params.side}
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
              accept=".xlsx"
              showUploadList={false}
              beforeUpload={async (file) => {
                try {
                  const r = await api.guests.import(file);
                  if (r.failed.length) Modal.warning({ title: `已导入${r.created}位，${r.failed.length}行未导入`, content: <div style={{ maxHeight: 300, overflowY: 'auto' }}>{r.failed.map((f) => <p key={f.row}>第{f.row}行：{f.reason}</p>)}</div> });
                  else message.success(`导入成功 ${r.created} 条`);
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
        locale={{ emptyText: list.isError ? '加载失败，请刷新重试' : params.archived === 'only' ? '暂无已归档宾客' : '暂无符合条件的宾客' }}
        rowKey="id"
        columns={columns}
        dataSource={list.data?.items ?? []}
        loading={list.isLoading}
        scroll={{ x: 1270 }}
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
          <Form.Item name="name" label="姓名" rules={[{ required: true, whitespace: true, max: MAX_NAME_LENGTH, message: '请填写姓名（1–50字）' }]}>
            <Input maxLength={MAX_NAME_LENGTH} />
          </Form.Item>
          <Form.Item name="salutation" label="称谓（用于请柬称呼）">
            <Input placeholder="如：张先生" />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input maxLength={30} />
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
                <Tag color={detail.data.guest.archivedAt == null ? STATUS_COLOR[detail.data.guest.status] : 'default'}>{detail.data.guest.archivedAt != null ? '已归档（历史记录保留）' : STATUS_LABEL[detail.data.guest.status]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="邀请链接">
                {detail.data.guest.archivedAt != null ? '已停用，恢复宾客后可用' : <a onClick={() => copyLink(detail.data!.guest)}>复制</a>}
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
                {formatDateTime(c.submittedAt)} · {({ pending: '待审核', confirmed: '已确认', rejected: '已驳回', cancelled: '已撤销' })[c.status]}
              </div>
            ))}
            <Typography.Title level={5} style={{ marginTop: 16 }}>
              礼金（合计 ¥{yuan(detail.data.giftTotal)}）
            </Typography.Title>
            {detail.data.gifts.map((g) => (
              <div key={g.id}>{formatDateTime(g.recordedAt)} · ¥{yuan(g.amount)}{g.voidedAt != null ? '（已作废，不计入合计）' : ''} · {g.method}</div>
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
