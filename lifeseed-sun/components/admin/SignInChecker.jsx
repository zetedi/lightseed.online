import { useUser } from './useUser';
import SignIn from './SignIn';

export default function ({ children }) {
  const me = useUser();
  if (!me) return <SignIn />;
  return children;
}
