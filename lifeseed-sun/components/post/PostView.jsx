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
  Grid,
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
    }
  }
`;

export default function PresentView({ id }) {
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
          <CardContent>
            <Grid
              container
              style={{ display: 'flex', flexDirection: 'column' }}
            >
              <Box style={{ padding: '.25rem', marginBottom: '1rem' }}>
                <Typography>{Present.body}</Typography>
              </Box>
            </Grid>
          </CardContent>
          <CardActions disableSpacing>
            <Link
              href={{
                pathname: '/posts',
              }}
            >
              <Button color="primary" variant="contained">
                Back
              </Button>
            </Link>
          </CardActions>
        </Card>
      </Box>
    </>
  );
}
