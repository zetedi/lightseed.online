import { useQuery } from '@apollo/client';
import { makeStyles } from '@material-ui/core/styles';
import gql from 'graphql-tag';
import Head from 'next/head';
import { Box, Button } from '@material-ui/core';
import Link from 'next/link';
import ErrorMessage from '../components/ErrorMessage';
import formatMoney from '../lib/formatMoney';

const USER_PACKAGES_QUERY = gql`
  query USER_PACKAGES_QUERY {
    allPackages {
      id
      charge
      total
      user {
        id
      }
      items {
        id
        name
        body
        price
        quantity
        photo {
          image {
            publicUrlTransformed
          }
        }
      }
    }
  }
`;

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
  packageItem: {
    boxShadow: 'var(--bs)',
    listStyle: 'none',
    padding: '2rem',
    border: '1px solid #ededed',
    '& h2': {
      borderBottom: '2px solid red',
      marginTop: 0,
      marginBottom: '2rem',
      paddingBottom: '2rem',
    },
    '& .package-meta': {
      gridTemplateColumns: 'repeat(auto-fit, minmax(20px, 1fr))',
      display: 'grid',
      gridGap: '1rem',
      textAlign: 'center',
      '& > *': {
        margin: 0,
        background: 'rgba(0, 0, 0, 0.03)',
        padding: '1rem 0',
      },
      '& strong': {
        display: 'block',
        marginBottom: '1rem',
      },
    },
  },
  images: {
    display: 'grid',
    gridGap: '10px',
    gridTemplateColumns: 'repeat(auto-fit, minmax(0, 1fr))',
    marginTop: '1rem',
    '& img': {
      height: '200px',
      objectFit: 'cover',
      width: '100%',
    },
  },
  package: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gridGap: '4rem',
  },
}));

function countItemsInAnPackage(package) {
  return package.items.reduce((tally, item) => tally + item.quantity, 0);
}

export default function PackagesPage() {
  const classes = useStyles();
  const { data, error, loading } = useQuery(USER_PACKAGES_QUERY);
  if (loading) return <p>Loading</p>;
  if (error) return <ErrorMessage error="error" />;
  const { allPackages } = data;
  return (
    <div>
      <h2>You have {allPackages.length} packages</h2>
      <Box className={classes.package}>
        {allPackages.map((package) => (
          <Box className={classes.packageItem} key={package.id}>
            <Link href={`/package/${package.id}`} key={package.id}>
              <a>
                <div className="package-meta">
                  <p>{countItemsInAnPackage(package)} item(s)</p>
                  <p>{package.items.length} present(s)</p>
                  <p>{formatMoney(package.total)}</p>
                </div>
                <Box className={classes.images}>
                  {package.items.map((item) => (
                    <img
                      key={`image-${item.id}`}
                      src={item.photo.image.publicUrlTransformed}
                      alt={item.name}
                    />
                  ))}
                </Box>
              </a>
            </Link>
          </Box>
        ))}
      </Box>
    </div>
  );
}
