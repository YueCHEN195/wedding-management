import { Alert, Button, Form, Input, Typography } from 'antd';
import { MAX_TEXT_LENGTH } from '@shared/constraints';
import { parseGiftYuan } from '@shared/numericInput';
import { METHOD_LABEL, yuan } from '@/lib/format';
import { AdminDrawer } from '../components/AdminDrawer';
import { AttendanceFields } from '../components/AttendanceFields';
import { OptionalGiftFields } from './OptionalGiftFields.view';
import { ReviewIdentityFields } from './ReviewIdentityFields.view';
import type { CheckinFormValues } from './checkinForm';
import { reviewInitialValues } from './checkinFormDefaults';
import type { ReviewWorkbenchModel } from './useReviewWorkbench';
const REVIEW_FORM_ID = 'review-checkin-form';
type Props = Pick<
  ReviewWorkbenchModel,
  | 'manualOpen'
  | 'confirming'
  | 'dirty'
  | 'active'
  | 'saving'
  | 'values'
  | 'manualName'
  | 'blockSave'
  | 'activeForm'
  | 'noLongerPending'
  | 'submitError'
  | 'candidates'
  | 'identity'
  | 'openRelatedPending'
  | 'candidateNamePending'
  | 'setNameComposing'
  | 'goToRecords'
  | 'setRecordAction'
  | 'setDirty'
  | 'submit'
  | 'closeDrawer'
  | 'afterDrawerClose'
>;
export function ReviewDrawer({ model }: { model: Props }) {
  const {
    manualOpen,
    confirming,
    dirty,
    active,
    saving,
    activeForm,
    noLongerPending,
    setRecordAction,
    setDirty,
    submit,
    closeDrawer,
  } = model;
  return (
    <AdminDrawer
      rootClassName="review-drawer"
      classNames={{ body: 'admin-module-scroll' }}
      styles={{
        body: { background: 'var(--admin-processing)' },
        footer: { background: 'var(--admin-processing)' },
      }}
      open={active}
      destroyOnHidden
      title={manualOpen ? '查人 / 手动补录' : `核对签到 · ${confirming?.guestName ?? ''}`}
      extra={<span className="review-connection">{dirty ? '有未保存的填写' : '请核对后保存'}</span>}
      onClose={closeDrawer}
      afterOpenChange={(open) => {
        if (!open) model.afterDrawerClose();
      }}
      mask={{ closable: !saving }}
      closable={!saving}
      keyboard={!saving}
      footer={<ReviewSaveFooter model={model} />}
    >
      <Typography.Paragraph type="secondary">
        {manualOpen
          ? '为现场来宾核对档案并登记到场'
          : `提交 #${confirming?.id} · ${confirming?.source === 'self' ? '自助扫码' : '手动补录'}`}
      </Typography.Paragraph>
      <Form<CheckinFormValues>
        autoComplete="off"
        id={REVIEW_FORM_ID}
        className="review-form"
        key={manualOpen ? 'manual' : `confirm-${confirming?.id}`}
        form={activeForm}
        layout="vertical"
        disabled={saving}
        initialValues={reviewInitialValues}
        onValuesChange={() => setDirty(true)}
        onFinish={submit}
      >
        <div className="review-form-body admin-module-scroll">
          <ReviewAlerts model={model} />
          <ReviewIdentityFields model={model} />
          <div className="review-section">
            <h3>实际到场</h3>
            <Typography.Paragraph type="secondary">
              总人数包含儿童；出席回执会自动带入，可按现场实际修改。
            </Typography.Paragraph>
            <div className="review-attendance">
              <AttendanceFields showHint={false} />
            </div>
          </div>
          <div className="review-section review-gift">
            <h3>礼金登记</h3>
            <OptionalGiftFields />
            <Form.Item
              name="note"
              label="备注（可选）"
              rules={[{ max: MAX_TEXT_LENGTH, message: '备注最多500字' }]}
            >
              <Input
                autoComplete="off"
                maxLength={MAX_TEXT_LENGTH}
                placeholder="补充现场核对信息"
              />
            </Form.Item>
          </div>
          {!manualOpen && confirming && (
            <div className="review-secondary-action">
              <Button
                type="text"
                disabled={saving || noLongerPending}
                onClick={() =>
                  setRecordAction({ entity: 'checkin', id: confirming.id, action: 'reject' })
                }
              >
                将此提交标记无效
              </Button>
              <Typography.Text type="secondary">
                填写原因后保留原提交，可在签到记录恢复
              </Typography.Text>
            </div>
          )}
        </div>
      </Form>
    </AdminDrawer>
  );
}

function ReviewSaveFooter({
  model,
}: {
  model: Pick<
    Props,
    'manualOpen' | 'manualName' | 'confirming' | 'values' | 'saving' | 'blockSave' | 'closeDrawer'
  >;
}) {
  const { manualOpen, manualName, confirming, values, saving, blockSave, closeDrawer } = model;
  const received = values.giftReceipt !== 'none';
  const amount = parseGiftYuan(values.amountYuan);
  const displayName = manualOpen ? manualName || '待填写姓名' : (confirming?.guestName ?? '');
  const saveLabel = received
    ? `确认到场并登记${amount == null ? '礼金' : ` ¥${yuan(amount)}`}`
    : '仅确认到场';
  return (
    <div className="review-save">
      <div className="review-save-summary" aria-live="polite">
        本次登记：<strong>{displayName}</strong> · {(values.actualHeadcountInput ?? '1') || '待填'}
        人（其中儿童
        {(values.actualChildrenInput ?? '0') || '待填'}人）
        <br />
        {received
          ? `礼金 ${amount == null ? '金额待填写' : `¥${yuan(amount)}`} · ${values.method ? METHOD_LABEL[values.method] : '现金'}`
          : '仅确认到场，不产生礼金记录'}
      </div>
      <div className="review-save-actions">
        <Button
          type="primary"
          htmlType="submit"
          form={REVIEW_FORM_ID}
          loading={saving}
          disabled={blockSave}
        >
          {saveLabel}
        </Button>
        <Button disabled={saving} onClick={closeDrawer}>
          取消填写
        </Button>
      </div>
    </div>
  );
}

function ReviewAlerts({
  model: { noLongerPending, confirming, submitError, goToRecords },
}: {
  model: Pick<Props, 'noLongerPending' | 'confirming' | 'submitError' | 'goToRecords'>;
}) {
  return (
    <>
      {' '}
      {noLongerPending && (
        <Alert
          type="warning"
          showIcon
          title="这条提交已不在待审核队列，可能已由其他人处理"
          description="输入已保留，请先查看签到记录核对结果，不能再次确认。"
          action={<Button onClick={goToRecords}>查看记录</Button>}
        />
      )}
      {confirming?.guestArchived && (
        <Alert
          type="warning"
          showIcon
          title="关联宾客已归档，请先由管理员恢复，或将本次提交标记无效"
        />
      )}
      {submitError && (
        <Alert type="error" showIcon title="本次保存未得到成功确认" description={submitError} />
      )}
    </>
  );
}
