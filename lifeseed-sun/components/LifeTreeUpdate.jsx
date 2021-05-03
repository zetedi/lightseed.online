import { useMutation, useQuery } from '@apollo/client';
import { CloudinaryContext, Image } from 'cloudinary-react';
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
import { openCustomUploadWidget } from '../lib/cloudinaryService';
import useForm from '../lib/useForm';
import DisplayError from './ErrorMessage';

const SINGLE_LIFETREE_QUERY = gql`
  query SINGLE_LIFETREE_QUERY($id: ID!) {
    LifeTree(where: { id: $id }) {
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
  root: {
    maxWidth: '25rem',
    '& .MuiTextField-root': {
      margin: theme.spacing(1),
    },
  },
  updateLifeTree: {
    margin: '1rem',
    padding: '1rem',
    maxWidth: '25rem',
    width: '100%',
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
    updateLifeTree(
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

export default function UpdateLifeTree({ id }) {
  const classes = useStyles();
  const [image, setImage] = useState();
  const { data = {}, loading } = useQuery(SINGLE_LIFETREE_QUERY, {
    variables: {
      id,
    },
  });
  const { inputs, handleChange } = useForm(
    data.LifeTree || {
      name: '',
      image: '',
      body: '',
      latitude: '',
      longitude: '',
    }
  );
  const beginUpload = () => {
    openCustomUploadWidget((error, photos) => {
      if (!error) {
        console.log(photos);
        if (photos.event === 'success') {
          setImage(photos.info.secure_url);
          console.log(photos.info);
        }
      } else {
        console.log(error);
      }
    });
  };

  console.log(inputs);
  const [updateLifeTree, { loading: updating, error }] = useMutation(
    UPDATE_LIFETREE_MUTATION,
    {
      variables: {
        id,
        ...inputs,
        image,
      },
      refetchQueries: [{ query: SINGLE_LIFETREE_QUERY, variables: { id } }],
    }
  );
  console.log(image);
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
            const res = await updateLifeTree({
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
              pathname: `/lifetree/${res?.data?.updateLifeTree?.id}`,
            });
          }}
        >
          <Card className={classes.lifeTree}>
            <Typography
              variant="h1"
              style={{ margin: '1rem', textAlign: 'center', color: '#272727' }}
            >
              Care
            </Typography>
            <Box style={{ display: 'grid', justifyContent: 'center' }}>
              <img className={classes.image} src={data.LifeTree?.image} />
            </Box>
            <CardContent>
              <DisplayError error={error} />
              {loading ? (
                <LinearProgress color="secondary" />
              ) : (
                <Grid container>
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
                  <CloudinaryContext cloudName="ezimg">
                    <Image
                      key={image}
                      publicId={image}
                      fetch-format="auto"
                      quality="auto"
                    />
                    <Button onClick={() => beginUpload('image')}>
                      Upload Image
                    </Button>
                  </CloudinaryContext>
                  <TextField
                    // type="textarea"
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
              >
                Back
              </Button>
              <Button
                color="primary"
                type="submit"
                style={{ marginLeft: 'auto' }}
              >
                Care
              </Button>
            </CardActions>
          </Card>
        </form>
      </Box>
    </>
  );
}
