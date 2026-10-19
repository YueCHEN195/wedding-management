import { useStaffGuests } from './guests/useStaffGuests';
import { StaffGuestsView } from './guests/StaffGuests.view';
import './guests.css';
export function StaffGuestsPage() {
  const model = useStaffGuests();
  return <StaffGuestsView model={model} />;
}
