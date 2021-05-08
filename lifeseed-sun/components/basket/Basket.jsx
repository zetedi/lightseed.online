import { makeStyles } from '@material-ui/core/styles';
import { Box, Drawer, IconButton, Paper } from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import { useLifeseed } from '../admin/useLifeseed';
import formatPrice from '../../lib/formatter';
import calcTotalPrice from '../../lib/calcTotalPrice';
import { useApp } from '../../lib/appState';
import RemoveFromBasket from './RemoveFromBasket';
import Checkout from './Checkout';

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
  basketItem: {
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
  basket: {
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

function BasketItem({ basketItem }) {
  const classes = useStyles();
  const { present } = basketItem;
  if (!present) return null;
  return (
    <Paper style={{ margin: '.3rem' }}>
      <Box className={classes.basketItem}>
        <img width="70" src={present.image} alt={present.name} />
        <div style={{ marginTop: '1rem' }}>
          <b>{present.name}</b>
          <br />
          <>
            {formatPrice(present.price * basketItem.quantity)}
            <br />
            <em>
              {basketItem.quantity} &times; {formatPrice(present.price)}
              {' each'}
            </em>
          </>
        </div>
        <RemoveFromBasket id={basketItem.id} />
      </Box>
    </Paper>
  );
}
export default function Basket() {
  const classes = useStyles();
  const me = useLifeseed();
  const { basketOpen, closeBasket } = useApp();
  if (!me) return null;
  return (
    <Drawer
      anchor="right"
      open={basketOpen}
      onClose={closeBasket}
      className={classes.basket}
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
          Basket
        </Box>
        <IconButton aria-label="closebasket" onClick={closeBasket}>
          <CloseIcon fontSize="normal" />
        </IconButton>
      </header>
      <Box style={{ minWidth: '30vw' }}>
        {me.basket.map((basketItem) => (
          <BasketItem key={basketItem.id} basketItem={basketItem} />
        ))}
      </Box>
      {me.basket.length === 0 ? (
        ''
      ) : (
        <footer>
          <Box style={{ direction: 'rtl', marginRight: '1rem' }}>
            {formatPrice(calcTotalPrice(me.basket))}
          </Box>
          <Checkout />
        </footer>
      )}
    </Drawer>
  );
}
