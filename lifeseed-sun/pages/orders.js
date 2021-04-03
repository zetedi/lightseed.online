import { useQuery } from '@apollo/client';
import { makeStyles } from '@material-ui/core/styles';
import gql from 'graphql-tag';
import Head from 'next/head';
import { Box, Button } from '@material-ui/core';
import Link from 'next/link';
import ErrorMessage from '../components/ErrorMessage';
import formatMoney from '../lib/formatMoney';

const USER_ORDERS_QUERY = gql`
  query USER_ORDERS_QUERY {
    allOrders {
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
  orderItem: {
    boxShadow: 'var(--bs)',
    listStyle: 'none',
    padding: '2rem',
    border: '1px solid #ededed',
    '& h2': {
      borderBottom: '2px solid red',
      marginTop: 0,
      marginBottom: '2rem',
      paddingBottom: '2rem',
    },
    '& .order-meta': {
      gridTemplateColumns: 'repeat(auto-fit, minmax(20px, 1fr))',
      display: 'grid',
      gridGap: '1rem',
      textAlign: 'center',
      '& > *': {
        margin: 0,
        background: 'rgba(0, 0, 0, 0.03)',
        padding: '1rem 0',
      },
      '& strong': {
        display: 'block',
        marginBottom: '1rem',
      },
    },
  },
  images: {
    display: 'grid',
    gridGap: '10px',
    gridTemplateColumns: 'repeat(auto-fit, minmax(0, 1fr))',
    marginTop: '1rem',
    '& img': {
      height: '200px',
      objectFit: 'cover',
      width: '100%',
    },
  },
  order: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gridGap: '4rem',
  },
}));

function countItemsInAnOrder(order) {
  return order.items.reduce((tally, item) => tally + item.quantity, 0);
}

export default function OrdersPage() {
  const classes = useStyles();
  const { data, error, loading } = useQuery(USER_ORDERS_QUERY);
  if (loading) return <p>Loading</p>;
  if (error) return <ErrorMessage error="error" />;
  const { allOrders } = data;
  return (
    <div>
      <h2>You have {allOrders.length} orders</h2>
      <Box className={classes.order}>
        {allOrders.map((order) => (
          <Box className={classes.orderItem}>
            <Link href={`/order/${order.id}`} key={order.id}>
              <a>
                <div className="order-meta">
                  <p>{countItemsInAnOrder(order)} item(s)</p>
                  <p>{order.items.length} product(s)</p>
                  <p>{formatMoney(order.total)}</p>
                </div>
                <Box className={classes.images}>
                  {order.items.map((item) => (
                    <img
                      key={`image-${item.id}`}
                      src={item.photo.image.publicUrlTransformed}
                      alt={item.name}
                    />
                  ))}
                </Box>
              </a>
            </Link>
          </Box>
        ))}
      </Box>
    </div>
  );
}
