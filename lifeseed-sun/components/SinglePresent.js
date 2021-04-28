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
  present: {
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
    Present(where: { id: $id }) {
      name
      price
      body
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

export default function SinglePresent({ id }) {
  const classes = useStyles();
  const { data, loading, error } = useQuery(SINGLE_ITEM_QUERY, {
    variables: { id },
  });

  if (loading) return <p>Loading...</p>;
  if (error) return <Box className={classes.error} error={error} />;
  const { Present } = data;
  console.log(Present);
  return (
    <Box className={classes.present}>
      <Head>
        <title>{Present.name}</title>
      </Head>
      <img
        src={Present.photo?.image?.publicUrlTransformed}
        alt={Present.photo?.altText}
      />
      <div className="details">
        <h2>{Present.name} </h2>
        <p>{Present.body}</p>
      </div>
    </Box>
  );
}
