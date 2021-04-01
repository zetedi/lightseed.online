import { useMutation } from '@apollo/client';
import gql from 'graphql-tag';
import { Button } from '@material-ui/core';
import ExitToApp from '@material-ui/icons/ExitToApp';
import { makeStyles } from '@material-ui/core/styles';
import { CURRENT_USER_QUERY } from './User';

const SIGNOUT_MUTATION = gql`
  mutation {
    endSession
  }
`;

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
}));

export default function SignOut() {
  const classes = useStyles();
  const [signout] = useMutation(SIGNOUT_MUTATION, {
    refetchQueries: [{ query: CURRENT_USER_QUERY }],
  });
  return (
    <Button
      className={classes.menuButton}
      type="button"
      onClick={signout}
      endIcon={<ExitToApp />}
    >
      Sign Out
    </Button>
  );
}
