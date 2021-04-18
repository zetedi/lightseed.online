import { useQuery } from '@apollo/client';
import gql from 'graphql-tag';
import Head from 'next/head';
import { makeStyles } from '@material-ui/core/styles';
import { Box } from '@material-ui/core';
import React from 'react';

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
  error: {
    padding: '2rem',
    background: 'white',
    margin: '2rem 0',
    border: '1px solid rgba(0, 0, 0, 0.05)',
    borderLeft: '5px solid red',
    '& p': {
      margin: '0',
      fontWeight: '100',
    },
    '& strong': {
      marginRight: '1rem',
    },
  },
  product: {
    display: 'grid',
    gridAutoColumns: '1fr',
    gridAutoFlow: 'column',
    maxWidth: '50rem',
    alignItems: 'top',
    justifyContent: 'center',
    gap: '2rem',
    '& img': {
      width: '100%',
      objectFit: 'contain',
    },
  },
}));

const SINGLE_ITEM_QUERY = gql`
  query SINGLE_ITEM_QUERY($id: ID!) {
    Product(where: { id: $id }) {
      name
      price
      description
      id
      photo {
        altText
        image {
          publicUrlTransformed
        }
      }
    }
  }
`;

export default function SingleProduct({ id }) {
  const classes = useStyles();
  const { data, loading, error } = useQuery(SINGLE_ITEM_QUERY, {
    variables: { id },
  });

  if (loading) return <p>Loading...</p>;
  if (error) return <Box className={classes.error} error={error} />;
  const { Product } = data;
  console.log(Product);
  return (
    <Box className={classes.product}>
      <Head>
        <title>{Product.name}</title>
      </Head>
      <img
        src={Product.photo?.image?.publicUrlTransformed}
        alt={Product.photo?.altText}
      />
      <div className="details">
        <h2>{Product.name} </h2>
        <p>{Product.description}</p>
      </div>
    </Box>
  );
}
