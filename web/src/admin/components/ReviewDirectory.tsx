import { useReviewDirectory, type ReviewDirectoryProps } from '../review/useReviewDirectory';
import { ReviewDirectoryView } from '../review/ReviewDirectory.view';
import { AttendanceEditor } from '../checkins/AttendanceEditor.view';
import { RecordAction, RecordHistory } from './RecordAction';
import { CheckinReassignment } from '../review/CheckinReassignment.view';
import { GiftEditor } from '../gifts/GiftEditor.view';
export function ReviewDirectory(props: ReviewDirectoryProps) {
  const model = useReviewDirectory(props.admin);
  return (
    <>
      {model.action && (
        <RecordAction
          key={`${model.action.id}-${model.action.action}`}
          target={model.action}
          onClose={() => model.setAction(null)}
        />
      )}
      {model.historyTarget != null && (
        <RecordHistory
          entity={model.historyTarget.entity}
          id={model.historyTarget.id}
          onClose={() => model.setHistoryTarget(null)}
        />
      )}
      <ReviewDirectoryView {...props} model={model} />
      <CheckinReassignment model={model.reassignment} />
      <GiftEditor model={model.giftEditor} />
      <AttendanceEditor
        model={{
          ...model.attendanceEditor,
          list: props.admin ? model.detail : model.staffDetail,
        }}
      />
    </>
  );
}
