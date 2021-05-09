import Link from 'next/link';
import { useMutation } from '@apollo/client';
import gql from 'graphql-tag';
import { makeStyles } from '@material-ui/core/styles';
import { Box } from '@material-ui/core';
import React from 'react';
import Card from '@material-ui/core/Card';
import CardHeader from '@material-ui/core/CardHeader';
import CardContent from '@material-ui/core/CardContent';
import CardActions from '@material-ui/core/CardActions';
import Avatar from '@material-ui/core/Avatar';
import IconButton from '@material-ui/core/IconButton';
import Typography from '@material-ui/core/Typography';
import FavoriteIcon from '@material-ui/icons/Favorite';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import moment from 'moment';
import formatPrice from '../../lib/formatter';
import { CURRENT_LIFESEED_QUERY } from '../admin/useLifeseed';

const DELETE_PRESENT_MUTATION = gql`
  mutation DELETE_PRESENT_MUTATION($id: ID!) {
    deletePresent(id: $id) {
      id
      name
    }
  }
`;

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
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
    minWidth: 320,
    margin: '1.2rem',
  },
  avatar: {
    backgroundColor: 'violet',
    border: '1px solid lightgrey',
  },
}));

function update(cache, payload) {
  cache.evict(cache.identify(payload.data.deletePresent));
}

export default function Present({ present }) {
  const { id } = present;
  const classes = useStyles();
  const [deletePresent, { loading }] = useMutation(DELETE_PRESENT_MUTATION, {
    variables: {
      id,
    },
    update,
  });
  return (
    <Box style={{ position: 'relative', maxWidth: 350 }}>
      <Card className={classes.root}>
        <Link href={`/post/${present.id}`}>
          <CardHeader
            avatar={
              <Avatar aria-label="lifetree" className={classes.avatar}>
                <img
                  src={present.lifeseed?.lifetree?.image}
                  style={{ height: '100%' }}
                />
              </Avatar>
            }
            action={
              <IconButton aria-label="settings">
                <MoreVertIcon />
              </IconButton>
            }
            title={present.name}
            style={{ cursor: 'pointer' }}
            subheader={moment(present.creationTime).fromNow()}
          />
        </Link>
        <CardContent>
          <Typography variant="body2" color="textSecondary" component="p">
            {present.body}
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
                deletePresent().catch((err) => alert(err.message));
              }
            }}
          >
            <DeleteOutlineIcon />
          </IconButton>
        </CardActions>
      </Card>
    </Box>
  );
}
