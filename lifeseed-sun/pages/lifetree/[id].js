import LifetreeView from '../../components/lifetree/LifetreeView';
import LifetreeCreate from '../../components/lifetree/LifetreeCreate';

export default function LifetreeViewPage({ query }) {
  return query.id ? <LifetreeView id={query.id} /> : <LifetreeCreate />;
}
