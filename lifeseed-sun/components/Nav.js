import Link from 'next/link';
import { useMutation } from '@apollo/client';
import { makeStyles } from '@material-ui/core/styles';
import ShoppingCartIcon from '@material-ui/icons/ShoppingCart';
import StorefrontIcon from '@material-ui/icons/Storefront';
import { Box, IconButton, Badge, Button } from '@material-ui/core';
import ExitToApp from '@material-ui/icons/ExitToApp';
import gql from 'graphql-tag';
import { useCart } from '../lib/cartState';
import { useUser, CURRENT_USER_QUERY } from './User';

const SIGNOUT_MUTATION = gql`
  mutation {
    endSession
  }
`;

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
  toolbar: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
}));

export default function Nav() {
  const user = useUser();
  const classes = useStyles();
  const [signout] = useMutation(SIGNOUT_MUTATION, {
    refetchQueries: [{ query: CURRENT_USER_QUERY }],
  });
  const { openCart } = useCart();
  return (
    <Box className={classes.toolbar}>
      <Link href="/products">
        <IconButton>
          <StorefrontIcon />
        </IconButton>
      </Link>
      {user && (
        <>
          <Link href="/sell">
            <Button className={classes.menuButton}>Offer</Button>
          </Link>
          <Link href="/orders">
            <Button className={classes.menuButton}>Orders</Button>
          </Link>
          <Link href="/account">
            <Button className={classes.menuButton}>Account</Button>
          </Link>
          <IconButton>
            <Badge
              badgeContent={user.cart.reduce(
                (tally, cartItem) =>
                  tally + (cartItem.product ? cartItem.quantity : 0),
                0
              )}
              color="secondary"
            >
              <ShoppingCartIcon onClick={openCart} />
            </Badge>
          </IconButton>
          <IconButton>
            <ExitToApp onClick={signout} />
          </IconButton>
          {/* <SignOut className={classes.menuButton} /> */}
        </>
      )}
      {!user && (
        <>
          <Link className={classes.link} href="/signin">
            <Button className={classes.menuButton}>Sign in</Button>
          </Link>
        </>
      )}
    </Box>
  );
}
