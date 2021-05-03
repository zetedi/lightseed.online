import { useMutation, useQuery } from '@apollo/client';
import gql from 'graphql-tag';
import Head from 'next/head';
import {
  Backdrop,
  Box,
  Button,
  CircularProgress,
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
import DisplayError from '../ErrorMessage';

const SINGLE_PRESENT_QUERY = gql`
  query SINGLE_PRESENT_QUERY($id: ID!) {
    Present(where: { id: $id }) {
      name
      price
      body
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
}));

const UPDATE_PRESENT_MUTATION = gql`
  mutation UPDATE_PRESENT_MUTATION(
    $id: ID!
    $name: String
    $body: String
    $price: Int
    $image: Upload
  ) {
    updatePresent(
      id: $id
      data: {
        name: $name
        body: $body
        price: $price
        photo: { create: { image: $image, altText: $name } }
      }
    ) {
      id
      price
      name
      body
    }
  }
`;

export default function PresentUpdate({ id }) {
  const classes = useStyles();
  const { data = {}, loading } = useQuery(SINGLE_PRESENT_QUERY, {
    variables: {
      id,
    },
  });
  const { inputs, handleChange } = useForm(
    data.Present || { name: '', price: '', body: '' }
  );
  const [updatePresent, { loading: updating, error }] = useMutation(
    UPDATE_PRESENT_MUTATION,
    {
      variables: {
        id,
        ...inputs,
      },
    }
  );
  if (updating)
    return (
      <Backdrop className={classes.backdrop} open={updating}>
        <CircularProgress color="inherit" />
      </Backdrop>
    );

  return (
    <>
      <Head>
        <title>{inputs.name}</title>
      </Head>
      <Box className={classes.space}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await updatePresent({
              variables: {
                id,
                name: inputs.name,
                body: inputs.body,
                price: inputs.price,
              },
            }).catch(console.error);
            Router.push({
              pathname: `/present/${res.data.updatePresent.id}`,
            });
          }}
        >
          <Card className={classes.cardView}>
            <Typography
              variant="h1"
              style={{ margin: '1rem', textAlign: 'center', color: '#272727' }}
            >
              Update
            </Typography>
            <Box style={{ display: 'grid', justifyContent: 'center' }}>
              <img
                className={classes.image}
                src={data.Present?.photo?.image?.publicUrlTransformed}
                alt={data.Present?.photo?.altText}
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
                    type="number"
                    id="price"
                    name="price"
                    label="Price"
                    placeholder="Price"
                    value={inputs.price}
                    onChange={handleChange}
                    variant="outlined"
                    className={classes.field}
                    size="small"
                  />
                  <TextField
                    // type="textarea"
                    multiline
                    rows={7}
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
                </Grid>
              )}
            </CardContent>
            <CardActions disableSpacing>
              <Button
                color="primary"
                onClick={() =>
                  Router.push({
                    pathname: `/presents`,
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
                Update
              </Button>
            </CardActions>
          </Card>
        </form>
      </Box>
    </>
  );
}
