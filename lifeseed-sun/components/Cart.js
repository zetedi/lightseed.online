import { makeStyles } from '@material-ui/core/styles';
import { Box, Drawer, IconButton, Paper } from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import { useUser } from './User';
import formatMoney from '../lib/formatMoney';
import calcTotalPrice from '../lib/calcTotalPrice';
import { useApp } from '../lib/appState';
import RemoveFromCart from './RemoveFromCart';
import Checkout from './Checkout';

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
  cartItem: {
    padding: '1rem',
    paddingRight: 0,
    paddingTop: 0,
    // borderBottom: '1px solid grey',
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    '& img': {
      borderRadius: '8px',
      marginRight: '1rem',
      marginTop: '1rem',
    },
    '& h3 p': {
      margin: 0,
    },
  },
  cart: {
    minWidth: '30rem',
    display: 'grid',
    gridTemplateRows: 'auto 1fr auto',
    '& header': {
      borderBottom: '5px solid var(--black)',
      marginBottom: '1rem',
      paddingBottom: '1rem',
    },
    '& footer': {
      position: 'absolute',
      bottom: 0,
      width: '100%',
      // height: '2.5rem',
      // borderTop: '2px solid grey',
      marginTop: '2rem',
      paddingTop: '2rem',
      // display: 'grid',
      // gridTemplateColumns: 'auto auto',
      alignItems: 'center',
      fontSize: '1.5rem',
      fontWeight: '400',
      '& p': {
        margin: '0',
      },
    },
    '& ul': {
      margin: '0',
      padding: '0',
      listStyle: 'none',
      overflow: 'hidden',
    },
  },
}));

function CartItem({ cartItem }) {
  const classes = useStyles();
  const { product } = cartItem;
  if (!product) return null;
  return (
    <Paper style={{ margin: '.3rem' }}>
      <Box className={classes.cartItem}>
        <img
          width="70"
          src={product.photo.image.publicUrlTransformed}
          alt={product.name}
        />
        <div style={{ marginTop: '1rem' }}>
          <b>{product.name}</b>
          <br />
          <>
            {formatMoney(product.price * cartItem.quantity)}
            <br />
            <em>
              {cartItem.quantity} &times; {formatMoney(product.price)}
              {' each'}
            </em>
          </>
        </div>
        <RemoveFromCart id={cartItem.id} />
      </Box>
    </Paper>
  );
}
export default function Cart() {
  const classes = useStyles();
  const me = useUser();
  const { cartOpen, closeCart } = useApp();
  if (!me) return null;
  return (
    <Drawer
      anchor="right"
      open={cartOpen}
      onClose={closeCart}
      className={classes.cart}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginLeft: '1rem',
        }}
      >
        {/* {me.name}'s  */}
        <Box
          style={{ marginTop: '1rem', fontSize: '1.5rem', fontWeight: '400' }}
        >
          Cart
        </Box>
        <IconButton aria-label="closecart" onClick={closeCart}>
          <CloseIcon fontSize="normal" />
        </IconButton>
      </header>
      <ul>
        {me.cart.map((cartItem) => (
          <CartItem key={cartItem.id} cartItem={cartItem} />
        ))}
      </ul>
      <footer>
        <Box style={{ direction: 'rtl', marginRight: '1rem' }}>
          {formatMoney(calcTotalPrice(me.cart))}
        </Box>
        <Checkout />
      </footer>
    </Drawer>
  );
}
