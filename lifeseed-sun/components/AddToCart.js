import { useMutation } from '@apollo/client';
import gql from 'graphql-tag';
import { Button } from '@material-ui/core';
import AddShoppingCartIcon from '@material-ui/icons/AddShoppingCart';
import { CURRENT_USER_QUERY } from './User';

const ADD_TO_CART_MUTATION = gql`
  mutation ADD_TO_CART_MUTATION($id: ID!) {
    addToCart(productId: $id) {
      id
    }
  }
`;

export default function AddToCart({ id }) {
  const [addToCart, { loading }] = useMutation(ADD_TO_CART_MUTATION, {
    variables: { id },
    refetchQueries: [{ query: CURRENT_USER_QUERY }],
  });
  return (
    <Button
      disabled={loading}
      endIcon={<AddShoppingCartIcon />}
      variant="outlined"
      color="primary"
      onClick={addToCart}
    >
      {' '}
      Add{loading && 'ing'} to cart
    </Button>
  );
}
