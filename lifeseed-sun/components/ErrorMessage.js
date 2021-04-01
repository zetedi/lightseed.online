import styled from 'styled-components';
import { makeStyles } from '@material-ui/core/styles';
import { Box } from '@material-ui/core';
import React from 'react';

import PropTypes from 'prop-types';

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
  error: {
    padding: '2rem',
    background: 'white',
    margin: '2rem 0',
    border: '1px solid rgba(0, 0, 0, 0.05)',
    borderLeft: '5px solid red',
    '& p': {
      margin: '0',
      fontWeight: '100',
    },
    '& strong': {
      marginRight: '1rem',
    },
  },
}));

const DisplayError = ({ error }) => {
  const classes = useStyles();
  if (!error || !error.message) return null;
  if (
    error.networkError &&
    error.networkError.result &&
    error.networkError.result.errors.length
  ) {
    return error.networkError.result.errors.map((error, i) => (
      <Box className={classes.error} key={i}>
        <p data-test="graphql-error">
          <strong>Shoot!</strong>
          {error.message.replace('GraphQL error: ', '')}
        </p>
      </Box>
    ));
  }
  return (
    <Box className={classes.error}>
      <p data-test="graphql-error">
        <strong>Shoot!</strong>
        {error.message.replace('GraphQL error: ', '')}
      </p>
    </Box>
  );
};

DisplayError.defaultProps = {
  error: {},
};

DisplayError.propTypes = {
  error: PropTypes.object,
};

export default DisplayError;
