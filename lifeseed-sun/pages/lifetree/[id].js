import LifeTreeView from '../../components/lifetree/LifeTreeView';
import LifeTreeCreate from '../../components/lifetree/LifeTreeCreate';

export default function LifeTreeViewPage({ query }) {
  return query.id ? <LifeTreeView id={query.id} /> : <LifeTreeCreate />;
}
