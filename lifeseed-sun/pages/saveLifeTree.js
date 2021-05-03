import LifeTreeCreate from '../components/LifeTreeCreate';

export default function SavePage({ query }) {
  return typeof query?.id !== 'undefined' ? (
    <LifeTreeCreate id={query.id} />
  ) : (
    <LifeTreeCreate />
  );
}
