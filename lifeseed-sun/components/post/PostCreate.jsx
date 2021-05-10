import { useMutation } from '@apollo/client';
import { useRouter } from 'next/dist/client/router';
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
import DisplayError from '../utils/ErrorMessage';
import { ALL_PRESENTS_QUERY } from './Posts';
import { perPage } from '../../config';

import { PAGINATION_QUERY } from '../utils/Pagination';

const CREATE_PRESENT_MUTATION = gql`
  mutation CREATE_PRESENT_MUTATION(
    $name: String!
    $body: String!
    $creationTime: String!
  ) {
    createPresent(
      data: {
        body: $body
        creationTime: $creationTime
        name: $name
        status: "AVAILABLE"
        type: "MESSAGE"
      }
    ) {
      id
      name
      body
    }
  }
`;

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
}));

export default function PostCreate() {
  const { t } = useTranslation();
  const classes = useStyles();
  const now = new Date().toISOString();

  const { inputs, handleChange, clearForm, resetForm } = useForm({
    name: '',
    body: '',
  });

  const [createPresent, { data, error, loading }] = useMutation(
    CREATE_PRESENT_MUTATION,
    {
      variables: { ...inputs, creationTime: now },
      refetchQueries: [
        {
          query: ALL_PRESENTS_QUERY,
          variables: {
            skip: 0,
            first: perPage,
          },
        },
        {
          query: ALL_PRESENTS_QUERY,
          variables: {
            skip: 0,
            first: perPage,
          },
        },
        {
          query: PAGINATION_QUERY,
          variables: { type: 'MESSAGE' },
        },
      ],
      awaitRefetchQueries: true,
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
              pathname: `/posts`,
            });

            // Router.push({
            //   pathname: `/post/${res.data.createPresent.id}`,
            // });
          }}
        >
          {loading ? (
            <LinearProgress color="secondary" />
          ) : (
            <Card className={classes.cardView}>
              <Typography variant="h1" className={classes.cardHeader}>
                Create post
              </Typography>
              <CardContent>
                <Grid container style={{ position: 'relative' }}>
                  <TextField
                    aria-label={t('Title')}
                    label={t('Title')}
                    id="name"
                    name="name"
                    size="small"
                    value={inputs.name}
                    onChange={handleChange}
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
                      pathname: `/posts`,
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
                  Post
                </Button>
              </CardActions>
            </Card>
          )}
        </form>
      </Box>
    </>
  );
}
