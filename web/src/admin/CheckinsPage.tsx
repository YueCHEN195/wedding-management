import { useCheckinsPage } from './checkins/useCheckinsPage';
import { CheckinsView } from './checkins/Checkins.view';
export function CheckinsPage() {
  const model = useCheckinsPage();
  return <CheckinsView model={model} />;
}
