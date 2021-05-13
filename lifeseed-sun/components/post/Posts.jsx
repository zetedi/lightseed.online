import { useQuery } from '@apollo/client';
import { makeStyles } from '@material-ui/core/styles';
import gql from 'graphql-tag';
import { Grid } from '@material-ui/core';
import CircularProgress from '@material-ui/core/CircularProgress';
import { perPage } from '../../config';
import Post from './Post';

// allPresents(first: $first, skip: $skip, where: { type: 'MESSAGE' }) {

export const ALL_PRESENTS_QUERY = gql`
  query ALL_PRESENTS_QUERY($skip: Int = 0, $first: Int) {
    allPresents(
      first: $first
      skip: $skip
      where: { type: "MESSAGE" }
      orderBy: "creationTime_DESC"
    ) {
      body
      comments {
        id
        creationTime
        body
        lifeseed {
          id
          lifetree {
            image
          }
        }
      }
      loves {
        id
        lifeseed {
          id
        }
      }
      creationTime
      id
      lifeseed {
        lifetree {
          image
        }
      }
      name
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
        <Post key={present.id} present={present} />
      ))}
    </Grid>
  );
}
