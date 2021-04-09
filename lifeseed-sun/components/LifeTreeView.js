import { useQuery } from '@apollo/client';
import gql from 'graphql-tag';
import Head from 'next/head';
import { makeStyles } from '@material-ui/core/styles';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CircularProgress,
  Typography,
} from '@material-ui/core';
import React from 'react';

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
  error: {
    padding: '2rem',
    background: 'white',
    margin: '2rem',
  },
  lifeTree: {
    margin: '1rem',
    width: 'fit-content',
    maxWidth: '50rem',
    alignItems: 'top',
    justifyContent: 'center',
    gap: '2rem',
    '& img': {
      width: '100%',
      maxWidth: '30rem',
      objectFit: 'contain',
    },
  },
  lifeTreeName: {
    margin: '1rem',
    textAlign: 'center',
    color: '#272727',
  },
  space: {
    backgroundColor: 'yellow',
    backgroundImage:
      'radial-gradient(yellow, yellow, lightyellow, #fafafa, #fafafa)',
    display: 'grid',
    justifyContent: 'center',
  },
}));

const LIFETREE_QUERY = gql`
  query LIFETREE_QUERY($id: ID!) {
    LifeTree(where: { id: $id }) {
      name
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

export default function LifeTreeView({ id }) {
  const classes = useStyles();
  const { data, loading, error } = useQuery(LIFETREE_QUERY, {
    variables: { id },
  });

  if (loading) return <CircularProgress />;
  if (error) return <Box className={classes.error} error={error} />;
  const { LifeTree } = data;
  console.log(LifeTree);
  return (
    <>
      <Head>
        <title>{LifeTree.name}</title>
      </Head>
      <Box className={classes.space}>
        <Card className={classes.lifeTree}>
          <Typography variant="h1" className={classes.lifeTreeName}>
            {LifeTree.name}
          </Typography>
          <img
            className={classes.image}
            src={LifeTree.photo.image.publicUrlTransformed}
            alt={LifeTree.photo.altText}
          />
          <CardContent>
            <Typography>{LifeTree.description}</Typography>
          </CardContent>
          <CardActions>
            <Button color="primary">Care</Button>
            <Button color="primary">Learn More</Button>
          </CardActions>
        </Card>
      </Box>
    </>
  );
}
