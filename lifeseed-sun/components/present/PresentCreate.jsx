import { useMutation } from '@apollo/client';
import Head from 'next/head';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Grid,
  LinearProgress,
  TextField,
  Typography,
} from '@material-ui/core';
import gql from 'graphql-tag';
import Router from 'next/router';
import { makeStyles } from '@material-ui/core/styles';
import useForm from '../../lib/useForm';
import CloudinaryImage from '../utils/CloudinaryImage';
import DisplayError from '../utils/ErrorMessage';
import { ALL_PRESENTS_QUERY } from './Presents';
import { CURRENT_LIFESEED_QUERY } from '../admin/useLifeseed';

const CREATE_PRESENT_MUTATION = gql`
  mutation CREATE_PRESENT_MUTATION(
    $name: String!
    $body: String!
    $price: Int!
    $image: String
    $creationTime: String!
  ) {
    createPresent(
      data: {
        body: $body
        creationTime: $creationTime
        image: $image
        name: $name
        price: $price
        status: "AVAILABLE"
        type: "OFFER"
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
  const [image, setImage] = useState();
  const now = new Date().toISOString();

  const { inputs, handleChange, clearForm, resetForm } = useForm({
    name: '',
    image: '',
    price: 0,
    body: '',
  });

  const [createPresent, { data, error, loading }] = useMutation(
    CREATE_PRESENT_MUTATION,
    {
      variables: { ...inputs, image, creationTime: now },
      refetchQueries: [
        { query: ALL_PRESENTS_QUERY },
        { query: CURRENT_LIFESEED_QUERY },
      ],
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
                Create present
              </Typography>
              <img className={classes.image} src={image} />
              <CardContent>
                <Grid container style={{ position: 'relative' }}>
                  <CloudinaryImage setImage={setImage} />
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
                  variant="contained"
                >
                  List
                </Button>
                <Button
                  color="primary"
                  type="submit"
                  style={{ marginLeft: 'auto' }}
                  variant="contained"
                >
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
