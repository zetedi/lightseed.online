import { useMutation, useQuery } from '@apollo/client';
import React, { useState } from 'react';
import gql from 'graphql-tag';
import Head from 'next/head';
import {
  Box,
  Button,
  Grid,
  LinearProgress,
  Card,
  CardActions,
  CardContent,
  Typography,
  TextField,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import Router from 'next/router';
import useForm from '../../lib/useForm';
import DisplayError from '../utils/ErrorMessage';
import CloudinaryImage from '../utils/CloudinaryImage';
import { CURRENT_LIFESEED_QUERY } from '../admin/useLifeseed';

const SINGLE_LIFETREE_QUERY = gql`
  query SINGLE_LIFETREE_QUERY($id: ID!) {
    Lifetree(where: { id: $id }) {
      id
      name
      image
      body
      status
      latitude
      longitude
    }
  }
`;

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
}));

const UPDATE_LIFETREE_MUTATION = gql`
  mutation UPDATE_LIFETREE_MUTATION(
    $id: ID!
    $name: String
    $image: String
    $body: String
    $latitude: String
    $longitude: String
  ) {
    updateLifetree(
      id: $id
      data: {
        name: $name
        body: $body
        image: $image
        latitude: $latitude
        longitude: $longitude
      }
    ) {
      id
      name
      image
      body
      latitude
      longitude
    }
  }
`;

export default function UpdateLifetree({ id }) {
  const classes = useStyles();
  const [image, setImage] = useState();
  const { data = {}, loading } = useQuery(SINGLE_LIFETREE_QUERY, {
    variables: {
      id,
    },
  });
  const { inputs, handleChange } = useForm(
    data.Lifetree || {
      name: '',
      image: '',
      body: '',
      latitude: '',
      longitude: '',
    }
  );
  const [updateLifetree, { loading: updating, error }] = useMutation(
    UPDATE_LIFETREE_MUTATION,
    {
      variables: {
        id,
        ...inputs,
        image,
      },
      refetchQueries: [
        { query: SINGLE_LIFETREE_QUERY, variables: { id } },
        { query: CURRENT_LIFESEED_QUERY },
      ],
    }
  );
  if (loading) return <p>Loading...</p>;

  return (
    <>
      <script
        src="https://widget.cloudinary.com/v2.0/global/all.js"
        type="text/javascript"
      />
      <Head>
        <title>{inputs.name}</title>
      </Head>

      <Box className={classes.space}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await updateLifetree({
              variables: {
                id,
                name: inputs.name,
                image,
                body: inputs.body,
                latitude: inputs.latitude,
                longitude: inputs.longitude,
              },
            }).catch(console.error);
            console.log(res);
            Router.push({
              pathname: `/lifetree/${res?.data?.updateLifetree?.id}`,
            });
          }}
        >
          <Card className={classes.cardView}>
            <Typography variant="h1" className={classes.cardHeader}>
              Grow {inputs.name}
            </Typography>
            <img
              className={classes.image}
              src={image || data.Lifetree?.image}
            />
            <CardContent>
              <DisplayError error={error} />
              {loading ? (
                <LinearProgress color="secondary" />
              ) : (
                <Grid container style={{ position: 'relative' }}>
                  <CloudinaryImage setImage={setImage} />
                  <TextField
                    type="text"
                    id="name"
                    name="name"
                    label="Name"
                    placeholder="Name"
                    value={inputs.name}
                    onChange={handleChange}
                    variant="outlined"
                    className={classes.field}
                    size="small"
                  />
                  <TextField
                    multiline
                    rows={4}
                    id="body"
                    name="body"
                    label="Body"
                    placeholder="Body"
                    value={inputs.body}
                    onChange={handleChange}
                    variant="outlined"
                    className={classes.field}
                    size="small"
                  />
                  <TextField
                    type="text"
                    id="latitude"
                    name="latitude"
                    label="Latitude"
                    placeholder="Latitude"
                    value={inputs.latitude}
                    onChange={handleChange}
                    variant="outlined"
                    className={classes.field}
                    size="small"
                  />
                  <TextField
                    type="text"
                    id="longitude"
                    name="longitude"
                    label="Longitude"
                    placeholder="Longitude"
                    value={inputs.longitude}
                    onChange={handleChange}
                    variant="outlined"
                    className={classes.field}
                    size="small"
                  />
                </Grid>
              )}
            </CardContent>
            <CardActions disableSpacing>
              <Button
                color="primary"
                onClick={() =>
                  Router.push({
                    pathname: `/lifetree/${id}`,
                  })
                }
                style={{
                  paddingRight: '1.4rem',
                  borderTopRightRadius: '50%',
                  borderBottomRightRadius: '50%',
                  boxShadow: '3px 3px 3px yellow',
                }}
                variant="contained"
              >
                Back
              </Button>
              <Button
                color="primary"
                type="submit"
                style={{
                  marginLeft: 'auto',
                  paddingLeft: '1.4rem',
                  borderTopLeftRadius: '50%',
                  borderBottomLeftRadius: '50%',
                  boxShadow: '3px 3px 3px yellow',
                }}
                variant="contained"
              >
                Save
              </Button>
            </CardActions>
          </Card>
        </form>
      </Box>
    </>
  );
}
