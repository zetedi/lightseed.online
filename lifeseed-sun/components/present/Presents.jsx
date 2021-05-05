import { useQuery } from '@apollo/client';
import { makeStyles } from '@material-ui/core/styles';
import gql from 'graphql-tag';
import { Grid } from '@material-ui/core';
import CircularProgress from '@material-ui/core/CircularProgress';
import { perPage } from '../../config';
import Present from './Present';

export const ALL_PRESENTS_QUERY = gql`
  query ALL_PRESENTS_QUERY($skip: Int = 0, $first: Int) {
    allPresents(first: $first, skip: $skip) {
      id
      name
      price
      body
      photo {
        id
        image {
          publicUrlTransformed
        }
      }
      user {
        lifeTree {
          photo {
            id
            image {
              publicUrlTransformed
            }
          }
        }
      }
    }
  }
`;

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
  presentList: {
    justifyContent: 'center',
  },
}));

export default function Presents({ page }) {
  const classes = useStyles();
  const { data, error, loading } = useQuery(ALL_PRESENTS_QUERY, {
    variables: {
      skip: page * perPage - perPage,
      first: perPage,
    },
  });
  if (loading) return <CircularProgress color="inherit" />;
  if (error) return <p>Error: {error.message}</p>;
  return (
    <Grid container spacing={1} className={classes.presentList}>
      {data?.allPresents.map((present) => (
        <Present key={present.id} present={present} />
      ))}
    </Grid>
  );
}
