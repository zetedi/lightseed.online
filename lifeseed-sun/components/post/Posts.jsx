import { useQuery } from '@apollo/client';
import { makeStyles } from '@material-ui/core/styles';
import { Grid } from '@material-ui/core';
import CircularProgress from '@material-ui/core/CircularProgress';
import { perPage } from '../../config';
import Post from './Post';
import { ALL_PRESENTS_QUERY } from '../common/PresentMutations';

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
      type: 'MESSAGE',
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
