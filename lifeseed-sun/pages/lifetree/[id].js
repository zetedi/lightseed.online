import LifeTreeView from '../../components/LifeTreeView';
import LifeTreeCreate from '../../components/LifeTreeCreate';

export default function LifeTreeViewPage({ query }) {
  return query.id ? <LifeTreeView id={query.id} /> : <LifeTreeCreate />;
}
