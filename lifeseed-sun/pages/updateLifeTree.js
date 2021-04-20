import UpdateLifeTree from '../components/UpdateLifeTree';

export default function UpdatePage({ query }) {
  return (
    <div>
      <UpdateLifeTree id={query.id} />
    </div>
  );
}
