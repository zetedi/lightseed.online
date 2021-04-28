import { useMutation } from '@apollo/client';
import gql from 'graphql-tag';
import { IconButton } from '@material-ui/core';
import RemoveShoppingCartIcon from '@material-ui/icons/RemoveShoppingCart';

const REMOVE_FROM_BASKET_MUTATION = gql`
  mutation REMOVE_FROM_BASKET_MUTATION($id: ID!) {
    deleteBasketItem(id: $id) {
      id
    }
  }
`;

function update(cache, payload) {
  cache.evict(cache.identify(payload.data.deleteBasketItem));
}

export default function RemoveFromBasket({ id }) {
  const [removeFromBasket, { loading }] = useMutation(
    REMOVE_FROM_BASKET_MUTATION,
    {
      variables: { id },
      update,
    }
  );
  return (
    <IconButton
      disabled={loading}
      title="Remove from basket"
      onClick={removeFromBasket}
      style={{ height: 'fit-content' }}
    >
      <RemoveShoppingCartIcon />
    </IconButton>
  );
}
