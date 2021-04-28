import UpdatePresent from '../components/UpdatePresent';

export default function UpdatePage({ query }) {
  return (
    <div>
      <UpdatePresent id={query.id} />
    </div>
  );
}
