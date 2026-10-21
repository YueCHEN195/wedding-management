import { useParams } from 'react-router-dom';
import { wedding } from '@shared/wedding';
import { useInvitation } from './useInvitation';
import { useCountdown } from './useCountdown';
import { InvitationView } from './Invitation.view';
export function InvitePage() {
  const { token } = useParams<{ token: string }>();
  return <Invitation key={token ?? 'universal'} token={token} />;
}
function Invitation({ token }: { token?: string }) {
  const model = useInvitation(token);
  const cd = useCountdown(wedding.date);
  return <InvitationView model={model} cd={cd} />;
}
