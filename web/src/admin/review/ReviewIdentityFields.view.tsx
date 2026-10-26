import { Form, Input } from 'antd';
import { GuestSelection } from './GuestSelection.view';
import type { ReviewWorkbenchModel } from './useReviewWorkbench';
type Props = Pick<
  ReviewWorkbenchModel,
  | 'manualOpen'
  | 'manualName'
  | 'candidates'
  | 'candidateNamePending'
  | 'setNameComposing'
  | 'identity'
  | 'openRelatedPending'
>;
export function ReviewIdentityFields({ model }: { model: Props }) {
  const {
    manualOpen,
    manualName,
    candidates,
    candidateNamePending,
    setNameComposing,
    identity,
    openRelatedPending,
  } = model;
  return (
    <div className="review-section">
      {manualOpen && (
        <Form.Item
          name="guestName"
          label="来宾姓名"
          rules={[{ required: true, whitespace: true, max: 30, message: '请填写姓名（1–30字）' }]}
        >
          <Input
            autoComplete="off"
            maxLength={30}
            placeholder="输入姓名查找宾客档案"
            onCompositionStart={() => setNameComposing(true)}
            onCompositionEnd={() => setNameComposing(false)}
          />
        </Form.Item>
      )}
      {(!manualOpen || !!manualName) && (
        <GuestSelection
          query={candidates}
          waitingForName={candidateNamePending}
          identity={identity}
          onOpenPending={openRelatedPending}
        />
      )}
    </div>
  );
}
