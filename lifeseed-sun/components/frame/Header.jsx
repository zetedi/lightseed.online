import { Box, Collapse } from '@material-ui/core';
import makeStyles from '@material-ui/core/styles/makeStyles';
import Basket from '../basket/Basket';
import Nav from './Nav';
import Search from '../utils/Search';
import Lifecircle from './Lifecircle';
import Lifeseed from './Lifeseed';
import { useApp } from '../../lib/appState';

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
  header: {
    alignItems: 'stretch',
    display: 'grid',
    gridTemplateColumns: 'auto 1fr 1fr',
    justifyContent: 'space-between',
    padding: '.7rem',
  },
}));

export default function Header() {
  const classes = useStyles();
  const { searchOpen } = useApp();
  return (
    <>
      <Box className={classes.header}>
        <>
          <Lifecircle />
          <Lifeseed />
        </>
        <Nav />
      </Box>
      <Collapse in={searchOpen}>
        <Search />
      </Collapse>
      <Basket />
    </>
  );
}
