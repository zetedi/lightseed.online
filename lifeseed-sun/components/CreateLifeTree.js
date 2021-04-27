import { useMutation, useQuery } from '@apollo/client';
import { CloudinaryContext, Image } from 'cloudinary-react';
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
import useForm from '../lib/useForm';
import DisplayError from './ErrorMessage';
import { CURRENT_USER_QUERY } from './User';
import { fetchPhotos, openCustomUploadWidget } from '../lib/cloudinaryService';

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

const CREATE_LIFETREE_MUTATION = gql`
  mutation CREATE_LIFETREE_MUTATION(
    $name: String
    $description: String
    $latitude: String
    $longitude: String
    $image: String
  ) {
    createLifeTree(
      data: {
        name: $name
        description: $description
        latitude: $latitude
        longitude: $longitude
        status: "ALIVE"
        image: $image
      }
    ) {
      id
      name
      description
      image
      latitude
      longitude
    }
  }
`;

function showUploadWidget() {
  console.log('window');
  console.log(window);
  window.cloudinary.openUploadWidget(
    {
      cloudName: 'ezimg',
      uploadPreset: 'wobiwbrp',
      sources: ['local', 'camera'],
      showAdvancedOptions: false,
      cropping: true,
      multiple: false,
      defaultSource: 'local',
      styles: {
        palette: {
          window: 'yellow',
          sourceBg: '#f4f4f5',
          windowBorder: '#90a0b3',
          tabIcon: '#000000',
          inactiveTabIcon: '#555a5f',
          menuIcons: '#555a5f',
          link: '#0433ff',
          action: '#339933',
          inProgress: '#0433ff',
          complete: '#339933',
          error: '#cc0000',
          textDark: '#000000',
          textLight: '#fcfffd',
        },
        fonts: {
          default: null,
          'sans-serif': {
            url: null,
            active: true,
          },
        },
      },
    },
    (err, info) => {
      if (!err) {
        console.log('Upload Widget event - ', info);
      }
    }
  );
}

export default function CreateLifeTree() {
  const classes = useStyles();
  const [image, setImage] = useState();
  const { inputs, handleChange, clearForm } = useForm({
    name: '',
    description: '',
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
  const [createLifeTree, { data, error, loading }] = useMutation(
    CREATE_LIFETREE_MUTATION,
    {
      variables: { ...inputs, image },
      refetchQueries: [{ query: CURRENT_USER_QUERY }],
    }
  );
  if (loading) return <p>Loading...</p>;

  return (
    <>
      <Head>
        <title>Plant lifeTree</title>
      </Head>
      <Box className={classes.space}>
        <form
          className={classes.root}
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await createLifeTree();
            clearForm();
            Router.push({
              pathname: `/lifetree/${res?.data?.createLifeTree?.id}`,
            });
          }}
        >
          <Card className={classes.lifeTree}>
            <Typography
              variant="h1"
              style={{ margin: '1rem', textAlign: 'center', color: '#272727' }}
            >
              Plant
            </Typography>
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
                    <Button onClick={() => showUploadWidget()}>
                      Upload Widget
                    </Button>
                  </CloudinaryContext>
                  <TextField
                    multiline
                    rows={4}
                    id="description"
                    name="description"
                    label="Description"
                    placeholder="Description"
                    value={inputs.description}
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
