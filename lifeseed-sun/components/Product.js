import Link from 'next/link';
import { makeStyles } from '@material-ui/core/styles';
import { Box, Button, Paper } from '@material-ui/core';
import formatMoney from '../lib/formatMoney';
import DeleteProduct from './DeleteProduct';
import AddToCart from './AddToCart';

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
  toolbar: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  priceTag: {
    background: 'red',
    transform: 'rotate(-3deg)',
    color: 'white',
    borderRadius: '10px',
    fontWeight: 600,
    padding: '7px',
    lineHeight: 1,
    fontSize: '2rem',
    display: 'inline-block',
    position: 'absolute',
    top: '79px',
    right: '-7px',
  },
  ltcTag: {
    background: 'green',
    transform: 'rotate(-3deg)',
    color: 'white',
    borderRadius: '10px',
    fontWeight: 600,
    padding: '7px',
    lineHeight: 1,
    fontSize: '2rem',
    display: 'inline-block',
    position: 'absolute',
    top: '17px',
    right: '-7px',
  },
  title: {
    margin: '0 1rem',
    textAlign: 'center',
    transform: 'skew(-5deg) rotate(-1deg)',
    marginTop: '-3rem',
    textShadow: '2px 2px 0 rgba(0, 0, 0, 0.1)',
    '& a': {
      background: 'red',
      display: 'inline',
      lineHeight: '1.3',
      fontSize: '4rem',
      textAlign: 'center',
      color: 'white',
      padding: '0 1rem',
    },
  },

  product: {
    backgroundColor: 'white',
    position: 'relative',
    margin: '1rem',
    display: 'flex',
    flexDirection: 'column',
    '& img': {
      width: '100%',
      height: '15rem',
      objectFit: 'cover',
    },
    '& p': {
      lineHeight: 2,
      fontWeight: 300,
      flexGrow: 1,
      padding: '0 3rem',
      fontSize: '1.5rem',
    },
    '& .buttonList': {
      display: 'grid',
      width: '100%',
      borderTop: '1px solid #e1e1e1',
      gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
      gridGap: '3px',
      background: '#e1e1e1',
      '& > *': {
        background: 'white',
      },
    },
  },
}));

export default function Product({ product }) {
  const classes = useStyles();
  return (
    <Paper className={classes.product} elevation={3}>
      <img
        src={product?.photo?.image?.publicUrlTransformed}
        alt={product.name}
      />
      <Box className={classes.title}>
        {' '}
        <Link href={`/product/${product.id}`}>{product.name}</Link>
      </Box>
      <Box className={classes.ltcTag}>{product.price / 100} ltc</Box>
      <Box className={classes.priceTag}>{formatMoney(product.price)}</Box>
      <p>{product.description}</p>
      <div className="buttonList">
        <Link
          href={{
            pathname: '/update',
            query: {
              id: product.id,
            },
          }}
        >
          <Button variant="outlined">Edit</Button>
        </Link>
        <DeleteProduct id={product.id}>Delete</DeleteProduct>
        <AddToCart id={product.id} />
      </div>
    </Paper>
  );
}
