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
  Typography,
} from '@material-ui/core';
import MapIcon from '@material-ui/icons/Map';
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
            <Grid
              container
              style={{ display: 'flex', flexDirection: 'column' }}
            >
              <Box style={{ padding: '.25rem', marginBottom: '1rem' }}>
                <Typography variant="body1">{Lifetree.body}</Typography>
              </Box>
              <Typography variant="body1">
                <b>Latitude:</b> {Lifetree.latitude}
              </Typography>
              <Typography variant="body1">
                <b>Longitude:</b> {Lifetree.longitude}
              </Typography>
              {/* <LifetreePosition
              latitude={Lifetree.latitude}
              longitude={Lifetree.longitude}
            /> */}
            </Grid>
          </CardContent>
          <CardActions disableSpacing style={{ position: 'relative' }}>
            <Link
              href={{
                pathname: '/map',
                query: {
                  id,
                },
              }}
            >
              <Button color="primary" variant="text" endIcon={<MapIcon />}>
                Map
              </Button>
            </Link>
            <Link
              href={{
                pathname: '/saveLifetree',
                query: {
                  id,
                },
              }}
            >
              <Box className={classes.growButton}>grow</Box>
            </Link>
          </CardActions>
        </Card>
      </Box>
    </>
  );
}
