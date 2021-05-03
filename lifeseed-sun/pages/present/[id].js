import PresentView from '../../components/present/PresentView';

export default function PresentViewPage({ query }) {
  return <PresentView id={query.id} />;
}
