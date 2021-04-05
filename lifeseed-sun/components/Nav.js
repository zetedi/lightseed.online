import Link from 'next/link';
import { useMutation } from '@apollo/client';
import { makeStyles } from '@material-ui/core/styles';
import ShoppingCartIcon from '@material-ui/icons/ShoppingCart';
import StorefrontIcon from '@material-ui/icons/Storefront';
import AllInboxIcon from '@material-ui/icons/AllInbox';
import TransitEnterexitIcon from '@material-ui/icons/TransitEnterexit';
import AccountCircleIcon from '@material-ui/icons/AccountCircle';
import NatureIcon from '@material-ui/icons/Nature';
import MapIcon from '@material-ui/icons/Map';
import LanguageIcon from '@material-ui/icons/Language';
import AddCircleIcon from '@material-ui/icons/AddCircle';
import { Box, IconButton, Badge } from '@material-ui/core';
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
    height: 'fit-content',
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
            <IconButton>
              <AddCircleIcon />
            </IconButton>
          </Link>
          <Link href="/orders">
            <IconButton>
              <AllInboxIcon />
            </IconButton>
          </Link>
          <Link href="/account">
            <IconButton>
              <AccountCircleIcon />
            </IconButton>
          </Link>
          <Link href="/lifetree">
            <IconButton>
              <NatureIcon />
            </IconButton>
          </Link>
          <Link href="/map">
            <IconButton>
              <MapIcon />
            </IconButton>
          </Link>
          <Link href="/lang">
            <IconButton>
              <LanguageIcon />
            </IconButton>
          </Link>
          <IconButton onClick={openCart}>
            <Badge
              badgeContent={user.cart.reduce(
                (tally, cartItem) =>
                  tally + (cartItem.product ? cartItem.quantity : 0),
                0
              )}
              color="secondary"
            >
              <ShoppingCartIcon />
            </Badge>
          </IconButton>
          <IconButton onClick={signout}>
            <ExitToApp />
          </IconButton>
        </>
      )}
      {!user && (
        <>
          <Link className={classes.link} href="/signin">
            <IconButton onClick={signout}>
              <TransitEnterexitIcon />
            </IconButton>
          </Link>
        </>
      )}
    </Box>
  );
}
