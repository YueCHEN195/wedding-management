import type { LifecycleEntity } from '@shared/types';
import { useRecordAction, useRecordHistory } from '../records/useRecordAction';
import { RecordActionView, RecordHistoryView } from '../records/RecordAction.view';
import type { RecordActionTarget } from '../records/types';
export { ACTION_LABEL, type RecordActionTarget } from '../records/types';
export function RecordAction({
  target,
  onClose,
}: {
  target: RecordActionTarget;
  onClose: () => void;
}) {
  const model = useRecordAction(target, onClose);
  return <RecordActionView target={target} model={model} />;
}
export function RecordHistory({
  entity,
  id,
  onClose,
}: {
  entity: LifecycleEntity;
  id: number;
  onClose: () => void;
}) {
  const query = useRecordHistory(entity, id);
  return <RecordHistoryView id={id} onClose={onClose} query={query} />;
}
