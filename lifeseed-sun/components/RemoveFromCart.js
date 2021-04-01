import { useMutation } from '@apollo/client';
import gql from 'graphql-tag';
import { Button } from '@material-ui/core';
import RemoveShoppingCartIcon from '@material-ui/icons/RemoveShoppingCart';

const REMOVE_FROM_CART_MUTATION = gql`
  mutation REMOVE_FROM_CART_MUTATION($id: ID!) {
    deleteCartItem(id: $id) {
      id
    }
  }
`;

function update(cache, payload) {
  cache.evict(cache.identify(payload.data.deleteCartItem));
}

export default function RemoveFromCart({ id }) {
  const [removeFromCart, { loading }] = useMutation(REMOVE_FROM_CART_MUTATION, {
    variables: { id },
    update,
  });
  return (
    <Button
      disabled={loading}
      title="Remove from cart"
      onClick={removeFromCart}
    >
      <RemoveShoppingCartIcon />
    </Button>
  );
}
