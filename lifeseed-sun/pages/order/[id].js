import { useQuery } from '@apollo/client';
import gql from 'graphql-tag';
import Head from 'next/head';
import { Box, Button } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import ErrorMessage from '../../components/ErrorMessage';
import formatMoney from '../../lib/formatMoney';

const SINGLE_ORDER_QUERY = gql`
  query SINGLE_ORDER_QUERY($id: ID!) {
    order: Order(where: { id: $id }) {
      id
      charge
      total
      user {
        id
      }
      items {
        id
        name
        description
        price
        quantity
        photo {
          image {
            publicUrlTransformed
          }
        }
      }
    }
  }
`;

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
  placedOrder: {
    maxWidth: '1000px',
    margin: '0 auto',
    border: '1px solid #ededed',
    boxShadow: '0 12px 24px 0 rgba(0,0,0,0.09)',
    padding: '2rem',
    borderTop: '10px solid red',
    '& > p': {
      display: 'grid',
      gridTemplateColumns: '1fr 5fr',
      margin: '0',
      borderBottom: '1px solid #ededed',
      '& span': {
        padding: '1rem',
        '&:first-child': {
          fontWeight: '900',
          textAlign: 'right',
        },
      },
    },
    '& .order-item': {
      borderBottom: '1px solid #ededed',
      display: 'grid',
      gridTemplateColumns: '300px 1fr',
      alignItems: 'center',
      gridGap: '2rem',
      margin: '2rem 0',
      paddingBottom: '2rem',
      '& img': {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      },
    },
  },
}));

export default function SingleOrderPage({ query }) {
  const classes = useStyles();
  const { data, error, loading } = useQuery(SINGLE_ORDER_QUERY, {
    variables: {
      id: query.id,
    },
  });
  if (loading) return <p>Loading</p>;
  if (error) return <ErrorMessage error="error" />;
  const { order } = data;
  return (
    <Box className={classes.placedOrder}>
      <Head>
        <title>Order - {order.id}</title>
      </Head>
      <p>
        <span>Order Id</span>
        <span>{order.id}</span>
      </p>
      <p>
        <span>Charge: </span>
        <span>{order.charge}</span>
      </p>
      <p>
        <span>Order total: </span>
        <span>{formatMoney(order.total)}</span>
      </p>
      <p>
        <span>ItemCount:</span>
        <span>{order.items.length}</span>
      </p>
      <div className="items">
        {order.items.map((item) => (
          <div className="order-item" key={item.id}>
            <img src={item.photo.image.publicUrlTransformed} alt={item.title} />
            <div className="item-details">
              <h2>{item.name}</h2>
              <p>Qty: {item.quantity}</p>
              <p>Each: {formatMoney(item.price)}</p>
              <p>Sub Total: {formatMoney(item.price * item.quantity)}</p>
              <p>{item.description}</p>
            </div>
          </div>
        ))}
      </div>

      {formatMoney(order.total)}
    </Box>
  );
}
