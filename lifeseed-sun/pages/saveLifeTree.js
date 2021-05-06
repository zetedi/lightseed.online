import LifetreeCreate from '../components/lifetree/LifetreeCreate';
import LifetreeUpdate from '../components/lifetree/LifetreeUpdate';
import SignInChecker from '../components/admin/SignInChecker';

export default function SavePage({ query }) {
  return (
    <SignInChecker>
      {typeof query?.id !== 'undefined' ? (
        <LifetreeUpdate id={query.id} />
      ) : (
        <LifetreeCreate />
      )}
    </SignInChecker>
  );
}
