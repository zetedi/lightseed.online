import { makeStyles } from '@material-ui/core/styles';
import { Box } from '@material-ui/core';
import React from 'react';

import PropTypes from 'prop-types';

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
  error: {
    color: 'red',
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
          {error.message.replace('GraphQL error: ', '')}
        </p>
      </Box>
    ));
  }
  return (
    <Box className={classes.error}>
      <p data-test="graphql-error">
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
