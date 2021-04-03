import { useMutation } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Divider,
  Grid,
  Input,
  LinearProgress,
  TextField,
} from '@material-ui/core';
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
  ...theme.customTheme,
  root: {
    '& .MuiTextField-root': {
      margin: theme.spacing(1),
    },
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
    <Box>
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
        {loading ? <LinearProgress color="secondary" /> : ''}
        <fieldset
          disabled={loading}
          aria-busy={loading}
          className={classes.fieldset}
        >
          <Grid container spacing={1}>
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
            {/* https://www.kurzor.net/blog/uploading-and-resizing-images-part1 */}
            <Input
              required
              type="file"
              id="image"
              name="image"
              onChange={handleChange}
              className={classes.field}
            />
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
            <TextField
              aria-label={t('Description')}
              label={t('Description')}
              id="description"
              name="description"
              size="small"
              value={inputs.description}
              onChange={handleChange}
              multiline
              rowsMax={10}
              variant="outlined"
              className={classes.field}
            />
            <Divider />
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
                Create
              </Button>
            </Box>
          </Grid>
        </fieldset>
      </form>
    </Box>
  );
}
