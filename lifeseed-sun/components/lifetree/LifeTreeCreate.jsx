import { useMutation, useQuery } from '@apollo/client';
import React, { useState, useEffect } from 'react';
import gql from 'graphql-tag';
import Head from 'next/head';
import {
  Box,
  Button,
  Grid,
  Input,
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
import { CURRENT_LIFESEED_QUERY } from '../admin/useLifeseed';
import CloudinaryImage from '../utils/CloudinaryImage';

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
}));

const CREATE_LIFETREE_MUTATION = gql`
  mutation CREATE_LIFETREE_MUTATION(
    $name: String
    $body: String
    $latitude: String
    $longitude: String
    $image: String
  ) {
    createLifetree(
      data: {
        name: $name
        body: $body
        latitude: $latitude
        longitude: $longitude
        status: "ALIVE"
        image: $image
      }
    ) {
      id
      name
      body
      image
      latitude
      longitude
    }
  }
`;

export default function CreateLifetree() {
  const classes = useStyles();
  const [image, setImage] = useState();
  const { inputs, handleChange, clearForm } = useForm({
    name: '',
    body: '',
    image: '',
    latitude: '',
    longitude: '',
  });
  const beginUpload = () => {
    openCustomUploadWidget((error, photos) => {
      if (!error) {
        console.log(photos);
        if (photos.event === 'success') {
          setImage(photos.info.secure_url);
          inputs.image = photos.info.secure_url;
          console.log(photos.info);
        }
      } else {
        console.log(error);
      }
    });
  };

  console.log(inputs);
  const [createLifetree, { data, error, loading }] = useMutation(
    CREATE_LIFETREE_MUTATION,
    {
      variables: { ...inputs, image },
      refetchQueries: [{ query: CURRENT_LIFESEED_QUERY }],
    }
  );
  if (loading) return <p>Loading...</p>;

  return (
    <>
      <Head>
        <title>Plant lifetree</title>
      </Head>
      <Box className={classes.space}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await createLifetree();
            clearForm();
            Router.push({
              pathname: `/lifetree/${res?.data?.createLifetree?.id}`,
            });
          }}
        >
          <Card className={classes.cardView}>
            <Typography variant="h1" className={classes.cardHeader}>
              {inputs.name || 'Plant a liftree'}
            </Typography>
            <img className={classes.image} src={image} />
            <CardContent>
              <DisplayError error={error} />
              {loading ? (
                <LinearProgress color="secondary" />
              ) : (
                <Grid container>
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
              {/* <Button
                color="primary"
                onClick={() =>
                  Router.push({
                    pathname: `/lifetree/${id}`,
                  })
                }
              >
                Back
              </Button> */}
              <Button
                color="primary"
                type="submit"
                style={{ marginLeft: 'auto' }}
                variant="contained"
              >
                Plant
              </Button>
            </CardActions>
          </Card>
        </form>
      </Box>
    </>
  );
}
