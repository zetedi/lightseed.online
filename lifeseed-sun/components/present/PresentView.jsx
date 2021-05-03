import React from 'react';
import Link from 'next/link';
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

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
}));

const SINGLE_ITEM_QUERY = gql`
  query SINGLE_ITEM_QUERY($id: ID!) {
    Present(where: { id: $id }) {
      name
      price
      body
      id
      image
      photo {
        altText
        image {
          publicUrlTransformed
        }
      }
    }
  }
`;

export default function ViewPresent({ id }) {
  const classes = useStyles();
  const { data, loading, error } = useQuery(SINGLE_ITEM_QUERY, {
    variables: { id },
  });
  if (loading) return <CircularProgress color="inherit" />;
  if (error) return <Box className={classes.error} error={error} />;
  const { Present } = data;
  return (
    <>
      <Head>
        <title>{Present.name}</title>
      </Head>

      <Box className={classes.space}>
        <Card className={classes.cardView}>
          <Typography variant="h1" className={classes.cardHeader}>
            {Present.name}
          </Typography>
          <img
            className={classes.image}
            src={Present.photo?.image?.publicUrlTransformed}
            alt={Present.photo?.altText}
          />
          <CardContent>
            <Typography>{Present.body}</Typography>
          </CardContent>
          <CardActions disableSpacing>
            <Link
              href={{
                pathname: '/presents',
              }}
            >
              <Button color="primary">Back</Button>
            </Link>
          </CardActions>
        </Card>
      </Box>
    </>
  );
}
