import { useMutation, useQuery } from '@apollo/client';
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

const SINGLE_LIFETREE_QUERY = gql`
  query SINGLE_LIFETREE_QUERY($id: ID!) {
    LifeTree(where: { id: $id }) {
      name
      description
      status
      latitude
      longitude
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
    $description: String
    $latitude: String
    $longitude: String
    $image: Upload
  ) {
    updateLifeTree(
      id: $id
      data: {
        name: $name
        description: $description
        latitude: $latitude
        longitude: $longitude
        photo: { create: { image: $image, altText: $name } }
      }
    ) {
      id
      name
      description
      latitude
      longitude
    }
  }
`;

export default function UpdateLifeTree({ id }) {
  const classes = useStyles();
  const { data = {}, loading } = useQuery(SINGLE_LIFETREE_QUERY, {
    variables: {
      id,
    },
  });
  const { inputs, handleChange } = useForm(
    data.LifeTree || { name: '', latitude: '', longitude: '', description: '' }
  );
  console.log(inputs);
  const [updateLifeTree, { loading: updating, error }] = useMutation(
    UPDATE_LIFETREE_MUTATION,
    {
      variables: {
        id,
        ...inputs,
      },
      refetchQueries: [{ query: SINGLE_LIFETREE_QUERY, variables: { id } }],
    }
  );
  if (loading) return <p>Loading...</p>;

  return (
    <>
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
                description: inputs.description,
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
              <img
                className={classes.image}
                src={data.LifeTree?.photo?.image?.publicUrlTransformed}
                alt={data.LifeTree?.photo?.altText}
              />
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
                  <Input
                    type="file"
                    id="image"
                    name="image"
                    onChange={handleChange}
                    className={classes.field}
                    size="small"
                  />
                  <TextField
                    // type="textarea"
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
