import UpdateLifeTree from '../components/UpdateLifeTree';
import CreateLifeTree from '../components/CreateLifeTree';

export default function SavePage({ query }) {
  return typeof query?.id !== 'undefined' ? (
    <UpdateLifeTree id={query.id} />
  ) : (
    <CreateLifeTree />
  );
}
