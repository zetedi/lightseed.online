import { useMutation, useQuery } from '@apollo/client';
import gql from 'graphql-tag';
import {
  Box,
  Button,
  Grid,
  Input,
  LinearProgress,
  TextField,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import Router from 'next/router';
import useForm from '../lib/useForm';
import DisplayError from './ErrorMessage';
import { ALL_PRODUCTS_QUERY } from './Products';

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
    '& .MuiTextField-root': {
      margin: theme.spacing(1),
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
    <div>
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
        <DisplayError error={error} />
        {loading ? <LinearProgress color="secondary" /> : ''}
        <fieldset
          disabled={loading}
          aria-busy={loading}
          className={classes.fieldset}
        >
          <Grid container spacing={1}>
            <TextField
              type="text"
              id="name"
              name="name"
              placeholde="Name"
              value={inputs.name}
              onChange={handleChange}
              variant="outlined"
              className={classes.field}
            />
            <Input
              type="file"
              id="image"
              name="image"
              onChange={handleChange}
              className={classes.field}
            />
            <TextField
              type="number"
              id="price"
              name="price"
              placeholde="price"
              value={inputs.price}
              onChange={handleChange}
              variant="outlined"
              className={classes.field}
            />
            <TextField
              type="textarea"
              id="description"
              name="description"
              placeholde="Description"
              value={inputs.description}
              onChange={handleChange}
              variant="outlined"
              className={classes.field}
            />
            <Box
              className={classes.addButton}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'flex-end',
                padding: '3rem',
              }}
            >
              <Button type="submit" variant="outlined">
                Update
              </Button>
            </Box>
          </Grid>
        </fieldset>
      </form>
    </div>
  );
}
