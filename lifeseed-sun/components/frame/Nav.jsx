import { useState } from 'react';
import { useMutation } from '@apollo/client';
import {
  Box,
  Drawer,
  IconButton,
  useMediaQuery,
  useTheme,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import MenuIcon from '@material-ui/icons/Menu';
import gql from 'graphql-tag';
import { useApp } from '../../lib/appState';
import { useUser, CURRENT_USER_QUERY } from '../admin/useUser';
import Menu from './Menu';

const SIGNOUT_MUTATION = gql`
  mutation {
    endSession
  }
`;

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
  toolbar: {
    display: 'flex',
    justifyContent: 'flex-end',
    height: 'fit-content',
  },
}));

export default function Nav() {
  const user = useUser();
  const classes = useStyles();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { openBasket, toggleSearch } = useApp();
  const [signout] = useMutation(SIGNOUT_MUTATION, {
    refetchQueries: [{ query: CURRENT_USER_QUERY }],
  });
  const theme = useTheme();
  function toggleMobileMenuOpen() {
    setMobileMenuOpen((prev) => !prev);
  }
  const isMediumOrBigger = useMediaQuery(theme.breakpoints.up('md'));
  return (
    <>
      {isMediumOrBigger ? (
        <Box className={classes.toolbar}>
          <Menu
            user={user}
            openBasket={openBasket}
            toggleSearch={toggleSearch}
            signout={signout}
          />
        </Box>
      ) : (
        <>
          <Box className={classes.toolbar}>
            <IconButton onClick={toggleMobileMenuOpen}>
              <MenuIcon size="large" />
            </IconButton>
          </Box>
          <Drawer
            anchor="right"
            open={mobileMenuOpen}
            onClose={toggleMobileMenuOpen}
            onClick={toggleMobileMenuOpen}
            classes={{
              paper: classes.drawerPaper,
            }}
          >
            <Menu
              user={user}
              openBasket={openBasket}
              toggleSearch={toggleSearch}
              signout={signout}
            />
          </Drawer>
        </>
      )}
    </>
  );
}
