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
import { ALL_PRESENTS_QUERY } from './Presents';

const CREATE_PRESENT_MUTATION = gql`
  mutation CREATE_PRESENT_MUTATION(
    $name: String!
    $body: String!
    $price: Int!
    $image: Upload
  ) {
    createPresent(
      data: {
        name: $name
        body: $body
        price: $price
        status: "AVAILABLE"
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

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
  root: {
    '& .MuiTextField-root': {
      margin: theme.spacing(1),
    },
  },
}));

export default function CreatePresent() {
  const { t } = useTranslation();
  const classes = useStyles();

  const { inputs, handleChange, clearForm, resetForm } = useForm({
    name: '',
    image: '',
    price: 0,
    body: '',
  });

  const [createPresent, { data, error, loading }] = useMutation(
    CREATE_PRESENT_MUTATION,
    {
      variables: inputs,
      refetchQueries: [{ query: ALL_PRESENTS_QUERY }],
    }
  );

  console.log(createPresent);
  return (
    <Box>
      <form
        className={classes.root}
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await createPresent();
          clearForm();
          Router.push({
            pathname: `/present/${res.data.createPresent.id}`,
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
              aria-label={t('Body')}
              label={t('Body')}
              id="body"
              name="body"
              size="small"
              value={inputs.body}
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
