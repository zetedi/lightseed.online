import { useQuery } from '@apollo/client';
import gql from 'graphql-tag';
import Head from 'next/head';
import { Box } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import ErrorMessage from '../../components/utils/ErrorMessage';
import formatPrice from '../../lib/formatter';

const SINGLE_PACKAGE_QUERY = gql`
  query SINGLE_PACKAGE_QUERY($id: ID!) {
    package: Package(where: { id: $id }) {
      id
      charge
      total
      lifeseed {
        id
      }
      items {
        id
        name
        body
        price
        quantity
        image
      }
    }
  }
`;

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
  placedPackage: {
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
    '& .package-item': {
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

export default function SinglePackagePage({ query }) {
  const classes = useStyles();
  const { data, error, loading } = useQuery(SINGLE_PACKAGE_QUERY, {
    variables: {
      id: query.id,
    },
  });
  if (loading) return <p>Loading</p>;
  if (error) return <ErrorMessage error="error" />;
  const { ipackage } = data;
  return (
    <Box className={classes.placedPackage}>
      <Head>
        <title>Package - {ipackage.id}</title>
      </Head>
      <p>
        <span>Package Id</span>
        <span>{ipackage.id}</span>
      </p>
      <p>
        <span>Charge: </span>
        <span>{ipackage.charge}</span>
      </p>
      <p>
        <span>Package total: </span>
        <span>{formatPrice(ipackage.total)}</span>
      </p>
      <p>
        <span>ItemCount:</span>
        <span>{ipackage.items.length}</span>
      </p>
      <div className="items">
        {ipackage.items.map((item) => (
          <div className="package-item" key={item.id}>
            <img src={item.image} alt={item.title} />
            <div className="item-details">
              <h2>{item.name}</h2>
              <p>Qty: {item.quantity}</p>
              <p>Each: {formatPrice(item.price)}</p>
              <p>Sub Total: {formatPrice(item.price * item.quantity)}</p>
              <p>{item.body}</p>
            </div>
          </div>
        ))}
      </div>

      {formatPrice(ipackage.total)}
    </Box>
  );
}
