import LifeTreeCreate from '../components/lifetree/LifeTreeCreate';
import LifeTreeUpdate from '../components/lifetree/LifeTreeUpdate';

export default function SavePage({ query }) {
  return typeof query?.id !== 'undefined' ? (
    <LifeTreeUpdate id={query.id} />
  ) : (
    <LifeTreeCreate />
  );
}
