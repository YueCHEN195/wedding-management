import { useRsvpsPage } from './rsvps/useRsvpsPage';
import { RsvpsView } from './rsvps/Rsvps.view';
export function RsvpsPage() {
  const model = useRsvpsPage();
  return <RsvpsView model={model} />;
}
