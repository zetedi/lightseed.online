import Link from 'next/link';
import Box from '@material-ui/core/Button';
import makeStyles from '@material-ui/core/styles/makeStyles';
import Cart from './Cart';
import Nav from './Nav';
import Search from './Search';
import Lifecircle from './Lifecircle';

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
  bar: {
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
  return (
    <>
      <div className={classes.bar}>
        <Lifecircle />
        <Nav />
      </div>
      <Search />
      <Cart />
    </>
  );
}
