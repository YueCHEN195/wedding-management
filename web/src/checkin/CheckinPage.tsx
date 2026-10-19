import { usePublicCheckin } from './usePublicCheckin';
import { CheckinView } from './Checkin.view';
export function CheckinPage() {
  const model = usePublicCheckin();
  return <CheckinView model={model} />;
}
