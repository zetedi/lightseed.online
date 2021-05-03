import PresentUpdate from '../components/present/PresentUpdate';

export default function UpdatePage({ query }) {
  return (
    <div>
      <PresentUpdate id={query.id} />
    </div>
  );
}
