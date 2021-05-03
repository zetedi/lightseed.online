import { useMutation } from '@apollo/client';
import Head from 'next/head';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Divider,
  Grid,
  Input,
  LinearProgress,
  TextField,
  Typography,
} from '@material-ui/core';
import gql from 'graphql-tag';
import Router from 'next/router';
import { makeStyles } from '@material-ui/core/styles';
import useForm from '../../lib/useForm';
import DisplayError from '../ErrorMessage';
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
}));

export default function PresentCreate() {
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
    <>
      <Head>
        <title>{inputs.name}</title>
      </Head>
      <DisplayError error={error} />
      <Box className={classes.space}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await createPresent();
            clearForm();
            Router.push({
              pathname: `/present/${res.data.createPresent.id}`,
            });
          }}
        >
          {loading ? (
            <LinearProgress color="secondary" />
          ) : (
            <Card className={classes.cardView}>
              <Typography variant="h1" className={classes.cardHeader}>
                Create
              </Typography>

              <CardContent>
                <Grid container>
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
                    rows={7}
                    variant="outlined"
                    className={classes.field}
                  />
                </Grid>
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
                  List
                </Button>
                <Button type="submit" style={{ marginLeft: 'auto' }}>
                  Create
                </Button>
              </CardActions>
            </Card>
          )}
        </form>
      </Box>
    </>
  );
}
