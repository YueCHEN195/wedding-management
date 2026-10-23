import { Button, Form, Input, Select, Typography, Alert } from 'antd';
import { MAX_NAME_LENGTH, MAX_TEXT_LENGTH } from '@shared/constraints';
import { ReasonInput } from '../components/ReasonInput';
import { giftCorrectionReasons } from '../records/reasonSuggestions';
import { parseGiftYuan } from '@shared/numericInput';
import type { GiftMethod } from '@shared/types';
import { METHOD_LABEL, yuan } from '@/lib/format';
import { AdminDrawer } from '../components/AdminDrawer';
import './gifts.css';
import { GiftCandidateSelection, GiftConflictFeedback } from './GiftFeedback.view';
import type { GiftEditorModel, GiftFormValues } from './useGiftEditor';
const FORM_ID = 'gift-editor';

export function GiftEditor({ model }: { model: GiftEditorModel }) {
  const {
    editing,
    creating,
    dirty,
    setDirty,
    form,
    saveError,
    conflict,
    name,
    candidateLookupPending,
    setNameComposing,
    save,
    close,
    submit,
  } = model;
  return (
    <AdminDrawer
      rootClassName="gift-drawer"
      title={editing ? `更正礼金 · ${editing.guestName} #${editing.id}` : '新增礼金'}
      open={creating}
      onClose={() => {
        void close();
      }}
      destroyOnHidden
      closable={!save.isPending}
      mask={{ closable: !save.isPending }}
      keyboard={!save.isPending}
      extra={dirty ? <Typography.Text type="secondary">有未保存的填写</Typography.Text> : undefined}
      footer={
        <div className="admin-drawer-footer">
          <Button
            disabled={save.isPending}
            onClick={() => {
              void close();
            }}
          >
            取消
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            form={FORM_ID}
            loading={save.isPending}
            disabled={
              conflict ||
              (!editing && !!name && (candidateLookupPending || model.candidates.isError))
            }
          >
            {editing ? '保存更正并留痕' : '登记礼金'}
          </Button>
        </div>
      }
    >
      {saveError && !conflict && (
        <Alert
          type="error"
          showIcon
          className="gift-feedback"
          title="本次更改尚未保存"
          description={saveError}
        />
      )}
      <GiftConflictFeedback model={model} />
      <Form<GiftFormValues>
        autoComplete="off"
        id={FORM_ID}
        form={form}
        disabled={save.isPending}
        layout="vertical"
        scrollToFirstError={{ block: 'center', focus: true }}
        onFinish={submit}
        onValuesChange={() => setDirty(true)}
        initialValues={{ method: 'cash' }}
      >
        <section className="gift-form-section">
          <h2>来宾与关联</h2>
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
            <Input
              disabled={!!editing}
              onCompositionStart={() => setNameComposing(true)}
              onCompositionEnd={() => setNameComposing(false)}
              maxLength={MAX_NAME_LENGTH}
              autoFocus={!editing}
              autoComplete="off"
              placeholder="填写实收礼金对应的姓名"
            />
          </Form.Item>
          <GiftCandidateSelection model={model} />
          {editing && (
            <p className="gift-helper">
              {editing.guestId != null ? `关联宾客 #${editing.guestId}` : '未关联宾客'}
              ；更正不会改变姓名与原关联。
            </p>
          )}
        </section>
        <section className="gift-form-section">
          <h2>实收礼金</h2>
          <div className="gift-form-grid">
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
              <Input
                autoComplete="off"
                inputMode="decimal"
                maxLength={12}
                prefix="¥"
                placeholder="例如：600.00"
              />
            </Form.Item>
            <Form.Item name="method" label="方式" rules={[{ required: true }]}>
              <Select
                options={Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))}
              />
            </Form.Item>
          </div>
          <Form.Item
            name="note"
            label="备注（可选）"
            rules={[{ max: MAX_TEXT_LENGTH, message: '备注最多500字' }]}
          >
            <Input.TextArea
              maxLength={MAX_TEXT_LENGTH}
              rows={3}
              showCount
              placeholder="补充收款或核对信息"
            />
          </Form.Item>
          {!editing && (
            <p className="gift-helper">仅登记已收到的礼金；保存后可在操作记录中追溯。</p>
          )}
        </section>
        {editing && (
          <section className="gift-form-section">
            <h2>更正与留痕</h2>
            <GiftChangePreview model={model} />
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
              <ReasonInput
                reasons={giftCorrectionReasons}
                maxLength={200}
                rows={2}
                showCount
                placeholder="例如：现场重新核对红包，原金额录入有误"
              />
            </Form.Item>
            <p className="gift-helper">
              保存后更新有效汇总，原金额、方式、备注和更正原因保留在操作记录中。
            </p>
          </section>
        )}
      </Form>
    </AdminDrawer>
  );
}

function GiftChangePreview({ model: { editing, form } }: { model: GiftEditorModel }) {
  const draftAmount = parseGiftYuan(Form.useWatch('amountYuan', form));
  const draftMethod = Form.useWatch('method', form) as GiftMethod | undefined;
  const draftNote = Form.useWatch('note', form) as string | undefined;
  if (!editing) return null;
  return (
    <section className="gift-change-preview" aria-label="保存前核对">
      <dl>
        <dt>当前记录</dt>
        <dd>
          ¥{yuan(editing.amount)} · {METHOD_LABEL[editing.method]}
        </dd>
      </dl>
      <dl>
        <dt>本次保存</dt>
        <dd>
          {draftAmount == null ? '请填写合法金额' : `¥${yuan(draftAmount)}`} ·{' '}
          {draftMethod ? METHOD_LABEL[draftMethod] : '请选择方式'}
        </dd>
      </dl>
      {(draftNote?.trim() || null) !== (editing.note?.trim() || null) && (
        <dl className="gift-note-change">
          <dt>备注变更</dt>
          <dd>
            {editing.note || '未填'} → {draftNote?.trim() || '未填'}
          </dd>
        </dl>
      )}
    </section>
  );
}
