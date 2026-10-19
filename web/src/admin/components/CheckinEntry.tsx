import { useCheckinEntry, type CheckinEntryProps } from '../review/useCheckinEntry';
import { CheckinEntryView } from '../review/CheckinEntry.view';
export function CheckinEntry(props: CheckinEntryProps) {
  const model = useCheckinEntry(props.onCreated);
  return <CheckinEntryView {...props} model={model} />;
}
