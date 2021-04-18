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

const SINGLE_PRODUCT_QUERY = gql`
  query SINGLE_PRODUCT_QUERY($id: ID!) {
    Product(where: { id: $id }) {
      name
      price
      description
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
  updateProduct: {
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

const UPDATE_PRODUCT_MUTATION = gql`
  mutation UPDATE_PRODUCT_MUTATION(
    $id: ID!
    $name: String
    $description: String
    $price: Int
    $image: Upload
  ) {
    updateProduct(
      id: $id
      data: {
        name: $name
        description: $description
        price: $price
        photo: { create: { image: $image, altText: $name } }
      }
    ) {
      id
      price
      name
      description
    }
  }
`;

export default function UpdateProduct({ id }) {
  const classes = useStyles();
  const { data = {}, loading } = useQuery(SINGLE_PRODUCT_QUERY, {
    variables: {
      id,
    },
  });
  const { inputs, handleChange } = useForm(
    data.Product || { name: '', price: '', description: '' }
  );
  console.log(inputs);
  const [updateProduct, { loading: updating, error }] = useMutation(
    UPDATE_PRODUCT_MUTATION,
    {
      variables: {
        id,
        ...inputs,
      },
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
            const res = await updateProduct({
              variables: {
                id,
                name: inputs.name,
                description: inputs.description,
                price: inputs.price,
              },
            }).catch(console.error);
            console.log(res);
            Router.push({
              pathname: `/product/${res.data.updateProduct.id}`,
            });
          }}
        >
          <Card className={classes.lifeTree}>
            <Typography
              variant="h1"
              style={{ margin: '1rem', textAlign: 'center', color: '#272727' }}
            >
              Update
            </Typography>
            <Box style={{ display: 'grid', justifyContent: 'center' }}>
              <img
                className={classes.image}
                src={data.Product?.photo?.image?.publicUrlTransformed}
                alt={data.Product?.photo?.altText}
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
                </Grid>
              )}
            </CardContent>
            <CardActions disableSpacing>
              <Button
                color="primary"
                onClick={() =>
                  Router.push({
                    pathname: `/products`,
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
