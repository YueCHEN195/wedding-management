import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { wedding } from '@shared/wedding';
import { useInvitation } from './useInvitation';
import { useCountdown } from './useCountdown';
import { InvitationView } from './Invitation.view';
export function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const [opened, setOpened] = useState(false);
  const cd = useCountdown(wedding.date);
  return (
    <Invitation
      key={token ?? 'universal'}
      token={token}
      cd={cd}
      opened={opened}
      setOpened={setOpened}
    />
  );
}
function Invitation({
  token,
  ...view
}: { token?: string } & Omit<Parameters<typeof InvitationView>[0], 'model'>) {
  const model = useInvitation(token);
  return <InvitationView {...view} model={model} />;
}
