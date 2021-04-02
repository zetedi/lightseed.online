import { useMutation } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { Button, Divider, Grid, TextField } from '@material-ui/core';
import gql from 'graphql-tag';
import Router from 'next/router';
import { makeStyles } from '@material-ui/core/styles';
import useForm from '../lib/useForm';
import DisplayError from './ErrorMessage';
import { ALL_PRODUCTS_QUERY } from './Products';

const CREATE_PRODUCT_MUTATION = gql`
  mutation CREATE_PRODUCT_MUTATION(
    $name: String!
    $description: String!
    $price: Int!
    $image: Upload
  ) {
    createProduct(
      data: {
        name: $name
        description: $description
        price: $price
        status: "AVAILABLE"
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

const useStyles = makeStyles((theme) => ({
  root: {
    '& .MuiTextField-root': {
      margin: theme.spacing(1),
      width: '25ch',
    },
  },
  field: {
    width: '100%',
  },
}));

export default function CreateProduct() {
  const { t } = useTranslation();
  const classes = useStyles();

  const { inputs, handleChange, clearForm, resetForm } = useForm({
    name: '',
    image: '',
    price: 0,
    description: '',
  });

  const [createProduct, { data, error, loading }] = useMutation(
    CREATE_PRODUCT_MUTATION,
    {
      variables: inputs,
      refetchQueries: [{ query: ALL_PRODUCTS_QUERY }],
    }
  );

  console.log(createProduct);
  return (
    <div>
      <form
        className={classes.root}
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await createProduct();
          clearForm();
          Router.push({
            pathname: `/product/${res.data.createProduct.id}`,
          });
        }}
      >
        <DisplayError error={error} />
        <fieldset
          disabled={loading}
          aria-busy={loading}
          style={{ display: 'flex' }}
        >
          <Grid container spacing={1}>
            {/* aria-busy> */}
            <TextField
              aria-label={t('Name')}
              label={t('Name')}
              id="name"
              name="name"
              size="small"
              value={inputs.name}
              onChange={handleChange}
              variant="outlined"
              className={classes.field}
            />
            <Divider />
            <label htmlFor="image">
              Image
              <input
                required
                type="file"
                id="image"
                name="image"
                onChange={handleChange}
                className={classes.field}
              />
            </label>
            <Divider />
            <TextField
              aria-label={t('Price')}
              label={t('Price')}
              id="price"
              name="price"
              size="small"
              value={inputs.price}
              onChange={handleChange}
              type="number"
              variant="outlined"
              className={classes.field}
            />
            <Divider />
            <TextField
              aria-label={t('Description')}
              label={t('Description')}
              id="description"
              name="description"
              size="small"
              value={inputs.description}
              onChange={handleChange}
              multiline
              rowsMax={4}
              variant="outlined"
              className={classes.field}
            />
            <Divider />
            <Button type="submit" variant="outlined">
              Add product
            </Button>
          </Grid>{' '}
        </fieldset>
      </form>
    </div>
  );
}
