import Link from 'next/link';
import { Badge, IconButton } from '@material-ui/core';
import ShoppingCartIcon from '@material-ui/icons/ShoppingCart';
import StorefrontIcon from '@material-ui/icons/Storefront';
import AllInboxIcon from '@material-ui/icons/AllInbox';
import TransitEnterexitIcon from '@material-ui/icons/TransitEnterexit';
import AccountCircleIcon from '@material-ui/icons/AccountCircle';
import NatureIcon from '@material-ui/icons/Nature';
import AccountBalanceWalletIcon from '@material-ui/icons/AccountBalanceWallet';
import ForumIcon from '@material-ui/icons/Forum';
import MapIcon from '@material-ui/icons/Map';
import LanguageIcon from '@material-ui/icons/Language';
import AddCircleIcon from '@material-ui/icons/AddCircle';
import SearchIcon from '@material-ui/icons/Search';
import ExitToApp from '@material-ui/icons/ExitToApp';

export default function Menu({ user, openCart, toggleSearch, signout }) {
  return (
    <>
      <Link href="/products">
        <IconButton>
          <StorefrontIcon />
        </IconButton>
      </Link>
      <IconButton onClick={toggleSearch}>
        <SearchIcon />
      </IconButton>
      {user && (
        <>
          <Link href="/forum">
            <IconButton>
              <ForumIcon />
            </IconButton>
          </Link>
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
          <Link href="/wallet">
            <IconButton>
              <AccountBalanceWalletIcon />
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
          <Link href="/signin">
            <IconButton onClick={signout}>
              <TransitEnterexitIcon />
            </IconButton>
          </Link>
        </>
      )}
    </>
  );
}
