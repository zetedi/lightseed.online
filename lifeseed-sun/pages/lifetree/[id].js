import LifeTreeView from '../../components/LifeTreeView';
import CreateLifeTree from '../../components/CreateLifeTree';

export default function LifeTreeViewPage({ query }) {
  return query.id ? <LifeTreeView id={query.id} /> : <CreateLifeTree />;
}
