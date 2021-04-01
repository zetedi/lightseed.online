import UpdateProduct from '../components/UpdateProduct';
import Page from '../components/Page';

export default function UpdatePage({ query }) {
  console.log(query);
  return (
    <div>
      <UpdateProduct id={query.id} />
    </div>
  );
}
