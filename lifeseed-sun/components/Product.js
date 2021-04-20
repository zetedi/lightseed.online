import Link from 'next/link';
import { useMutation } from '@apollo/client';
import gql from 'graphql-tag';
import { makeStyles } from '@material-ui/core/styles';
import { Box } from '@material-ui/core';
import React from 'react';
import Card from '@material-ui/core/Card';
import CardHeader from '@material-ui/core/CardHeader';
import CardMedia from '@material-ui/core/CardMedia';
import CardContent from '@material-ui/core/CardContent';
import CardActions from '@material-ui/core/CardActions';
import Avatar from '@material-ui/core/Avatar';
import IconButton from '@material-ui/core/IconButton';
import Typography from '@material-ui/core/Typography';
import FavoriteIcon from '@material-ui/icons/Favorite';
import EditIcon from '@material-ui/icons/Edit';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import AddShoppingCartIcon from '@material-ui/icons/AddShoppingCart';
import formatMoney from '../lib/formatMoney';
import { CURRENT_USER_QUERY } from './User';

const ADD_TO_CART_MUTATION = gql`
  mutation ADD_TO_CART_MUTATION($id: ID!) {
    addToCart(productId: $id) {
      id
    }
  }
`;

const DELETE_PRODUCT_MUTATION = gql`
  mutation DELETE_PRODUCT_MUTATION($id: ID!) {
    deleteProduct(id: $id) {
      id
      name
    }
  }
`;

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
  priceTag: {
    background: theme.palette.secondary.contrastText,
    transform: 'rotate(-3deg)',
    color: 'white',
    borderRadius: '4px',
    fontWeight: 400,
    padding: '7px',
    lineHeight: 1,
    fontSize: '1.2rem',
    display: 'inline-block',
    position: 'absolute',
    top: '147px',
    right: '-3px',
    boxShadow: '5px 3px 3px  #FFFFFF',
  },
  ltcTag: {
    background: theme.palette.primary.main,
    transform: 'rotate(-3deg)',
    color: 'white',
    borderRadius: '4px',
    fontWeight: 400,
    padding: '7px',
    lineHeight: 1,
    fontSize: '1.2rem',
    display: 'inline-block',
    position: 'absolute',
    top: '107px',
    right: '-3px',
    boxShadow: '5px 3px 3px  #FFFFFF',
  },
  title: {
    margin: '0 1rem',
    textAlign: 'center',
    transform: 'skew(-5deg) rotate(-1deg)',
    marginTop: '-3rem',
    textShadow: '2px 2px 0 rgba(0, 0, 0, 0.1)',
    '& a': {
      background: theme.palette.secondary.main,
      display: 'inline',
      lineHeight: '1.3',
      fontSize: '4rem',
      textAlign: 'center',
      color: 'white',
      padding: '0 1rem',
    },
  },
  root: {
    maxWidth: 340,
    margin: '1.2rem',
  },
  media: {
    height: 0,
    paddingTop: '56.25%', // 16:9
  },
  avatar: {
    backgroundColor: 'violet',
    border: '1px solid lightgrey',
  },
}));

function update(cache, payload) {
  cache.evict(cache.identify(payload.data.deleteProduct));
}

export default function Product({ product }) {
  const { id } = product;
  const [deleteProduct, { loading }] = useMutation(DELETE_PRODUCT_MUTATION, {
    variables: {
      id,
    },
    update,
  });
  const [addToCart, { loadingAdd }] = useMutation(ADD_TO_CART_MUTATION, {
    variables: { id },
    refetchQueries: [{ query: CURRENT_USER_QUERY }],
  });

  const classes = useStyles();
  return (
    <Box style={{ position: 'relative', maxWidth: 350 }}>
      <Card className={classes.root}>
        <Link href={`/product/${product.id}`}>
          <CardHeader
            avatar={
              <Avatar aria-label="recipe" className={classes.avatar}>
                <img
                  src={
                    product.user?.lifeTree?.photo?.image?.publicUrlTransformed
                  }
                  alt={product.user?.lifeTree?.photo?.image?.altText}
                  style={{ width: '100%' }}
                />
              </Avatar>
            }
            action={
              <IconButton aria-label="settings">
                <MoreVertIcon />
              </IconButton>
            }
            title={product.name}
            subheader="September 14, 2016"
          />
        </Link>
        <CardMedia
          className={classes.media}
          image={product?.photo?.image?.publicUrlTransformed}
          title={product.name}
        />
        <CardContent>
          <Typography variant="body2" color="textSecondary" component="p">
            {product.description}
          </Typography>
        </CardContent>

        <CardActions disableSpacing>
          <IconButton aria-label="add to favorites">
            <FavoriteIcon />
          </IconButton>
          <IconButton
            aria-label="share"
            disabled={loading}
            variant="outlined"
            onClick={() => {
              if (confirm('Are you sure you want to delete it?')) {
                deleteProduct().catch((err) => alert(err.message));
              }
            }}
          >
            <DeleteOutlineIcon />
          </IconButton>
          <Link
            href={{
              pathname: '/updateProduct',
              query: {
                id: product.id,
              },
            }}
          >
            <IconButton>
              <EditIcon />
            </IconButton>
          </Link>
          <IconButton
            disabled={loading}
            endIcon={<AddShoppingCartIcon />}
            variant="outlined"
            onClick={addToCart}
          >
            <AddShoppingCartIcon />
          </IconButton>
        </CardActions>
      </Card>
      <Box className={classes.ltcTag}>
        {product.price / 100} <small>|=|</small>
      </Box>
      <Box className={classes.priceTag}>{formatMoney(product.price)}</Box>
    </Box>
  );
}
