import Link from 'next/link';
import { Box, Collapse } from '@material-ui/core';
import makeStyles from '@material-ui/core/styles/makeStyles';
import Cart from './Cart';
import Nav from './Nav';
import Search from './Search';
import Lifecircle from './Lifecircle';
import { useApp } from '../lib/appState';

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
  header: {
    // backgroundColor: theme.palette.primary.active,
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    padding: '.7rem',
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },
}));

export default function Header() {
  const classes = useStyles();
  const { searchOpen } = useApp();
  return (
    <>
      <div className={classes.header}>
        <Lifecircle />
        <Nav />
      </div>
      <Collapse in={searchOpen}>
        <Search />
      </Collapse>
      <Cart />
    </>
  );
}
