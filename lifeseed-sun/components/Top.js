import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { AppBar, Box, Toolbar, useMediaQuery } from '@material-ui/core';
import { useLocation } from 'react-router-dom';

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
  root: {
    backgroundColor: ({ showShadow }) =>
      showShadow ? theme.palette.white : 'transparent',
    paddingTop: '0.5rem',
    paddingBottom: '0.5rem',
    color: theme.palette.mainText,
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  menuButton: {
    marginRight: theme.spacing(2),
  },
  strong: {
    fontWeight: 'bold',
  },
  logo: {
    marginRight: '1.5em',
  },
  title: ({ withColor }) => ({
    flexGrow: 1,
    textTransform: 'uppercase',
    fontSize: 'small',
    borderLeft: `1px solid ${
      withColor ? theme.palette.highlightsAndDividers : theme.palette.white
    }`,
    alignSelf: 'center',
    padding: '1rem',
  }),
  toolBar: {
    display: 'flex',
    justifyContent: 'space-between',
    color: theme.palette.mainText,
  },
}));

export default function Header({ breakpointSmall, showShadow, withColor }) {
  const classes = useStyles({ showShadow, withColor });

  const location = useLocation();
  const isMediumOrSmaller = useMediaQuery((theme) =>
    theme.breakpoints.down('md')
  );
  const isNewSubmissionPage = location.pathname.includes('/draft');

  const isMenuVisible = () => !isNewSubmissionPage || isMediumOrSmaller;

  return (
    <AppBar
      position="static"
      className={classes.root}
      elevation={showShadow ? 2 : 0}
    >
      <Toolbar className={classes.toolbar}>
        <Logo
          breakpointSmall={breakpointSmall}
          classes={classes}
          withColor={withColor}
        />
        {isMenuVisible() && (
          <Box display="flex">
            <Menu />
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}
