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
  Grid,
  Divider,
  Typography,
} from '@material-ui/core';
// import LifetreePosition from './LifetreePosition';

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
}));

const LIFETREE_QUERY = gql`
  query LIFETREE_QUERY($id: ID!) {
    Lifetree(where: { id: $id }) {
      id
      name
      body
      image
      latitude
      longitude
      photo {
        altText
        image {
          publicUrlTransformed
        }
      }
    }
  }
`;

export default function LifetreeView({ id }) {
  const classes = useStyles();
  const { data, loading, error } = useQuery(LIFETREE_QUERY, {
    variables: { id },
  });

  if (loading) return <CircularProgress />;
  if (error) return <Box className={classes.error} error={error} />;
  const { Lifetree } = data;
  console.log(Lifetree);
  return (
    <>
      <Head>
        <title>{Lifetree.name}</title>
      </Head>
      <Box className={classes.space}>
        <Card className={classes.cardView}>
          <Typography variant="h1" className={classes.cardHeader}>
            {Lifetree.name}
          </Typography>
          <Box style={{ display: 'grid', justifyContent: 'center' }}>
            <img className={classes.image} src={Lifetree?.image} />
          </Box>
          <CardContent>
            <Grid container>
              <Typography>{Lifetree.body}</Typography>
              <Typography>
                <b>Latitude:</b> {Lifetree.latitude}
              </Typography>
              <Typography>
                <b>Longitude:</b> {Lifetree.longitude}
              </Typography>
              {/* <LifetreePosition
              latitude={Lifetree.latitude}
              longitude={Lifetree.longitude}
            /> */}
            </Grid>
          </CardContent>
          <CardActions disableSpacing>
            <Button color="primary" variant="contained">
              Map
            </Button>
            <Link
              href={{
                pathname: '/saveLifetree',
                query: {
                  id,
                },
              }}
            >
              <Button
                color="primary"
                style={{ marginLeft: 'auto' }}
                variant="contained"
              >
                Grow
              </Button>
            </Link>
          </CardActions>
        </Card>
      </Box>
    </>
  );
}
