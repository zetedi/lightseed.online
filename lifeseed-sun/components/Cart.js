import { makeStyles } from '@material-ui/core/styles';
import { Box, Drawer, IconButton } from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import { useUser } from './User';
import formatMoney from '../lib/formatMoney';
import calcTotalPrice from '../lib/calcTotalPrice';
import { useCart } from '../lib/cartState';
import RemoveFromCart from './RemoveFromCart';
import Checkout from './Checkout';

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
  cartItem: {
    padding: '1rem',
    paddingRight: 0,
    // borderBottom: '1px solid grey',
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    '& img': {
      marginRight: '1rem',
      borderRadius: '8px',
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
    <>
      <Box className={classes.cartItem}>
        <img
          width="70"
          src={product.photo.image.publicUrlTransformed}
          alt={product.name}
        />
        <div>
          <h3>{product.name}</h3>
          <p>
            {formatMoney(product.price * cartItem.quantity)}-
            <em>
              {cartItem.quantity} &times; {formatMoney(product.price)}
              each
            </em>
          </p>
        </div>
        <RemoveFromCart id={cartItem.id} />
      </Box>
    </>
  );
}
export default function Cart() {
  const classes = useStyles();
  const me = useUser();
  const { cartOpen, closeCart } = useCart();
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
