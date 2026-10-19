import { Alert, Button, Form, Input, Modal, Select, Typography } from 'antd';
import { MAX_NAME_LENGTH, MAX_TEXT_LENGTH } from '@shared/constraints';
import { parseGiftYuan } from '@shared/numericInput';
import type { GiftMethod } from '@shared/types';
import { METHOD_LABEL, SIDE_LABEL, yuan } from '@/lib/format';
import type { GiftEditorModel } from './useGiftEditor';
export function GiftEditor({ model }: { model: GiftEditorModel }) {
  const { editing, creating, form, saveError, conflict, name, candidates, save, close, submit } =
    model;
  return (
    <Modal
      title={editing ? `更正礼金 · ${editing.guestName} #${editing.id}` : '新增礼金'}
      width={680}
      style={{ top: 24 }}
      styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' } }}
      open={creating}
      onCancel={close}
      okText={editing ? '保存更正并留痕' : '登记礼金'}
      onOk={() => form.submit()}
      confirmLoading={save.isPending}
      cancelButtonProps={{ disabled: save.isPending }}
      okButtonProps={{
        disabled:
          save.isPending ||
          conflict ||
          (!editing && !!name && (candidates.isFetching || candidates.isError)),
      }}
      destroyOnClose
    >
      {saveError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          title="本次更改尚未保存"
          description={saveError}
        />
      )}
      <GiftConflictFeedback model={model} />
      <Form
        form={form}
        disabled={save.isPending}
        layout="vertical"
        onFinish={submit}
        initialValues={{ method: 'cash' }}
      >
        <Form.Item
          name="guestName"
          label="姓名"
          rules={[
            {
              required: true,
              whitespace: true,
              max: MAX_NAME_LENGTH,
              message: '请填写姓名（1–50字）',
            },
          ]}
        >
          <Input disabled={!!editing} maxLength={MAX_NAME_LENGTH} />
        </Form.Item>
        <GiftCandidateSelection model={model} />
        {editing && (
          <Typography.Paragraph type="secondary">
            {editing.guestId != null ? `关联宾客 #${editing.guestId}` : '未关联宾客'}
            ；编辑不会改变原关联。
          </Typography.Paragraph>
        )}
        <Form.Item
          name="amountYuan"
          label="金额（元）"
          rules={[
            { required: true, message: '请填写金额（0.01–100000元）' },
            {
              validator: (_, v) =>
                parseGiftYuan(v) != null
                  ? Promise.resolve()
                  : Promise.reject(new Error('金额须为0.01–100000元，最多两位小数')),
            },
          ]}
        >
          <Input inputMode="decimal" maxLength={12} placeholder="例如：600.00" />
        </Form.Item>
        <Form.Item name="method" label="方式" rules={[{ required: true }]}>
          <Select
            options={Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))}
          />
        </Form.Item>
        <GiftChangePreview model={model} />
        <Form.Item
          name="note"
          label="备注"
          rules={[{ max: MAX_TEXT_LENGTH, message: '备注最多500字' }]}
        >
          <Input maxLength={MAX_TEXT_LENGTH} />
        </Form.Item>
        {editing && (
          <Form.Item
            name="reason"
            label="更正原因"
            rules={[
              {
                required: true,
                whitespace: true,
                max: 200,
                message: '请填写具体更正原因（最多200字）',
              },
            ]}
          >
            <Input.TextArea
              maxLength={200}
              rows={2}
              placeholder="例如：现场重新核对红包，原金额录入有误"
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}

function GiftConflictFeedback({ model }: { model: GiftEditorModel }) {
  const { conflict, latest, recheckDraft } = model;
  if (!conflict) return null;
  return (
    <Alert
      type="warning"
      showIcon
      style={{ marginBottom: 16 }}
      title="请先核对最新账目，你的草稿已保留"
      description={
        <>
          {latest.isFetching ? (
            <p>正在读取最新记录…</p>
          ) : latest.isError ? (
            <p>无法读取最新记录，请重试。</p>
          ) : (
            latest.data && (
              <>
                <p>
                  最新记录：¥{yuan(latest.data.amount)} · {METHOD_LABEL[latest.data.method]} ·{' '}
                  {latest.data.voidedAt == null ? '有效' : '已撤回，当前不能更正'}
                </p>
                <p style={{ overflowWrap: 'anywhere' }}>最新备注：{latest.data.note || '未填'}</p>
                {latest.data.voidedAt == null && (
                  <Button onClick={recheckDraft}>保留我的修改，载入最新记录核对</Button>
                )}
              </>
            )
          )}
          <Button
            type="link"
            disabled={latest.isFetching}
            onClick={() => {
              void latest.refetch();
            }}
          >
            重新读取最新记录
          </Button>
        </>
      }
    />
  );
}

function GiftCandidateSelection({ model }: { model: GiftEditorModel }) {
  const { editing, name, candidates } = model;
  if (editing || !name) return null;
  return (
    <>
      {candidates.isFetching && <Typography.Paragraph>正在核对当前宾客名单…</Typography.Paragraph>}
      {candidates.isError && (
        <Alert
          type="error"
          title="无法核对宾客名单，请重试"
          action={
            <Button
              onClick={() => {
                void candidates.refetch();
              }}
            >
              重试
            </Button>
          }
        />
      )}
      {candidates.isSuccess && candidates.data.length > 0 && (
        <Form.Item
          name="guestId"
          label="对应宾客"
          rules={[{ required: true, message: '请选择对应宾客，或明确选择单独记礼金' }]}
        >
          <Select
            placeholder="按编号、归属和分组核对"
            options={[
              ...candidates.data.map((g) => ({
                value: g.id as number | 'none',
                label: `#${g.id} · ${g.name} · ${g.side ? SIDE_LABEL[g.side] : '归属未填'} · ${g.groupName || '未分组'} · ${g.checkedIn ? '已签到' : '未签到'}`,
              })),
              { value: 'none' as const, label: '不关联当前宾客，单独记礼金' },
            ]}
            optionRender={(o) => <span style={{ whiteSpace: 'normal' }}>{o.label}</span>}
          />
        </Form.Item>
      )}
      {candidates.isSuccess && candidates.data.length === 0 && (
        <Typography.Paragraph type="secondary">
          未找到同名的当前宾客；此笔礼金将独立保存，不会自动建立宾客档案。
        </Typography.Paragraph>
      )}
    </>
  );
}

function GiftChangePreview({ model: { editing, form } }: { model: GiftEditorModel }) {
  const draftAmount = parseGiftYuan(Form.useWatch('amountYuan', form));
  const draftMethod = Form.useWatch('method', form) as GiftMethod | undefined;
  const draftNote = Form.useWatch('note', form) as string | undefined;
  if (!editing) return null;
  return (
    <Alert
      showIcon
      type="info"
      style={{ marginBottom: 16 }}
      title="保存前核对"
      description={
        <>
          <p>
            原记录：¥{yuan(editing.amount)} · {METHOD_LABEL[editing.method]}
          </p>
          <p>
            本次修改：{draftAmount == null ? '请填写合法金额' : `¥${yuan(draftAmount)}`} ·{' '}
            {draftMethod ? METHOD_LABEL[draftMethod] : '请选择方式'}
          </p>
          {(draftNote?.trim() || null) !== (editing.note?.trim() || null) && (
            <p style={{ overflowWrap: 'anywhere' }}>
              备注：{editing.note || '未填'} → {draftNote?.trim() || '未填'}
            </p>
          )}
          <span>保存后按新金额计入有效汇总，原金额、方式、备注及更正原因保留在操作记录中。</span>
        </>
      }
    />
  );
}
