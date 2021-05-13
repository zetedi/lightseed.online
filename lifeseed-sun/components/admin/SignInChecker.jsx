import { useLifeseed } from './useLifeseed';
import SignIn from './SignIn';

export default function SignInChecker({ children }) {
  const me = useLifeseed();
  if (!me) return <SignIn />;
  return children;
}
