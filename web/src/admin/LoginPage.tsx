import { LoginView } from './session/Login.view';
import { useLogin } from './session/useLogin';

export function LoginPage() {
  return <LoginView model={useLogin()} />;
}
