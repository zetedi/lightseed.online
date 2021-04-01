import { makeStyles } from '@material-ui/core/styles';
import { Box, Drawer, IconButton } from '@material-ui/core';
import CloseCart from '@material-ui/icons/CancelPresentationOutlined';
import { useUser } from './User';
import formatMoney from '../lib/formatMoney';
import calcTotalPrice from '../lib/calcTotalPrice';
import { useCart } from '../lib/cartState';
import RemoveFromCart from './RemoveFromCart';
import Checkout from './Checkout';

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
  cartItem: {
    padding: '1rem 0',
    borderBottom: '1px solid var(--lightGrey)',
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    '& img': {
      marginRight: '1rem',
    },
    '& h3 p': {
      margin: 0,
    },
  },
  cart: {
    minWidth: '500px',
    display: 'grid',
    gridTemplateRows: 'auto 1fr auto',
    '& header': {
      borderBottom: '5px solid var(--black)',
      marginBottom: '2rem',
      paddingBottom: '2rem',
    },
    '& footer': {
      borderTop: '10px double #000',
      marginTop: '2rem',
      paddingTop: '2rem',
      /* display: grid;
    grid-template-columns: auto auto; */
      alignItems: 'center',
      fontSize: '3rem',
      fontWeight: '900',
      '& p': {
        margin: '0',
      },
    },
    '& ul': {
      margin: '0',
      padding: '0',
      listStyle: 'none',
      overflow: 'scroll',
    },
  },
}));

function CartItem({ cartItem }) {
  const classes = useStyles();
  const { product } = cartItem;
  if (!product) return null;
  return (
    <Box className={classes.cartItem}>
      <img
        width="100"
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
      <header style={{ display: 'flex', justifyContent: 'space-between' }}>
        {me.name}'s carting
        <IconButton aria-label="closecart" onClick={closeCart}>
          <CloseCart fontSize="large" />
        </IconButton>
      </header>
      <ul>
        {me.cart.map((cartItem) => (
          <CartItem key={cartItem.id} cartItem={cartItem} />
        ))}
      </ul>
      <footer>
        <p>{formatMoney(calcTotalPrice(me.cart))}</p>
        <Checkout />
      </footer>
    </Drawer>
  );
}
