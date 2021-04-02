import Head from 'next/head';
import Link from 'next/link';
import gql from 'graphql-tag';
import { useQuery } from '@apollo/client';
import { makeStyles } from '@material-ui/core/styles';
import { Box } from '@material-ui/core';
import NavigateBeforeIcon from '@material-ui/icons/NavigateBefore';
import NavigateNextIcon from '@material-ui/icons/NavigateNext';
import DisplayError from './ErrorMessage';
import { perPage } from '../config';

export const PAGINATION_QUERY = gql`
  query PAGINATION_QUERY {
    _allProductsMeta {
      count
    }
  }
`;

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
  pagination: {
    textAlign: 'center',
    display: 'inline-grid',
    gridTemplateColumns: 'repeat(4, auto)',
    alignItems: 'stretch',
    justifyContent: 'center',
    alignContent: 'center',
    margin: '2rem 0',
    border: '1px solid black',
    borderRadius: '10px',
    '& > *': {
      margin: 0,
      padding: '15px 30px',
      borderRight: '1px solid var(--lightGray)',
      '&:last-child': {
        borderRight: 0,
      },
    },
    'a[aria-disabled=true]': {
      color: 'grey',
      pointerEvents: 'none',
    },
  },
}));

export default function Pagination({ page }) {
  const classes = useStyles();
  const { error, loading, data } = useQuery(PAGINATION_QUERY);
  if (loading) return 'Loading...';
  if (error) return <DisplayError error={error} />;
  const { count } = data._allProductsMeta;
  const pageCount = Math.ceil(count / perPage);
  return (
    <Box className={classes.pagination}>
      <Head>
        <title>
          Webshop - Page {page} of {pageCount}
        </title>
      </Head>
      <Link href={`/products/${page - 1}`}>
        <a aria-disabled={page <= 1}>
          <NavigateBeforeIcon />
        </a>
      </Link>
      <p>
        Page {page} of {pageCount}{' '}
      </p>
      <p>{count} Items total</p>
      <Link href={`/products/${page + 1}`}>
        <a aria-disabled={page >= pageCount}>
          <NavigateNextIcon />
        </a>
      </Link>
    </Box>
  );
}
