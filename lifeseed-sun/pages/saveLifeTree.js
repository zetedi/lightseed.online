import LifeTreeCreate from '../components/lifetree/LifeTreeCreate';
import LifeTreeUpdate from '../components/lifetree/LifeTreeUpdate';
import SignInChecker from '../components/admin/SignInChecker';

export default function SavePage({ query }) {
  return (
    <SignInChecker>
      {typeof query?.id !== 'undefined' ? (
        <LifeTreeUpdate id={query.id} />
      ) : (
        <LifeTreeCreate />
      )}
    </SignInChecker>
  );
}
