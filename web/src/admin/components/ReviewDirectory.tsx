import { useReviewDirectory, type ReviewDirectoryProps } from '../review/useReviewDirectory';
import { ReviewDirectoryView } from '../review/ReviewDirectory.view';
import { AttendanceEditor } from '../checkins/AttendanceEditor.view';
import { RecordAction, RecordHistory } from './RecordAction';
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
      {model.historyId != null && (
        <RecordHistory
          entity="checkin"
          id={model.historyId}
          onClose={() => model.setHistoryId(null)}
        />
      )}
      <ReviewDirectoryView {...props} model={model} />
      {props.admin && (
        <>
          <GiftEditor model={model.giftEditor} />
          <AttendanceEditor model={{ ...model.attendanceEditor, list: model.detail }} />
        </>
      )}
    </>
  );
}
