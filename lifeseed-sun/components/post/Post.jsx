import Link from 'next/link';
import { useMutation } from '@apollo/client';
import gql from 'graphql-tag';
import { makeStyles } from '@material-ui/core/styles';
import {
  Box,
  Button,
  Collapse,
  Dialog,
  TextField,
  Tooltip,
} from '@material-ui/core';
import React, { useState, useRef } from 'react';
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
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import clsx from 'clsx';
import Badge from '@material-ui/core/Badge';
import ChatIcon from '@material-ui/icons/Chat';
import { useLifeseed } from '../admin/useLifeseed';

const DELETE_PRESENT_MUTATION = gql`
  mutation DELETE_PRESENT_MUTATION($id: ID!) {
    deletePresent(id: $id) {
      id
      name
    }
  }
`;

const CREATE_COMMENT_MUTATION = gql`
  mutation CREATE_COMMENT_MUTATION($id: ID!) {
    createComment(presentId: $id) {
      id
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
  expand: {
    transform: 'rotate(0deg)',
    marginLeft: 'auto',
    transition: theme.transitions.create('transform', {
      duration: theme.transitions.duration.shortest,
    }),
  },
  expandOpen: {
    transform: 'rotate(180deg)',
  },
}));

function update(cache, payload) {
  cache.evict(cache.identify(payload.data.deletePresent));
}

export default function Post({ present, page }) {
  const { id } = present;
  const lifeseed = useLifeseed();
  const classes = useStyles();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [commentExpanded, setCommentExpanded] = useState(false);
  const [comment, setComment] = useState('');
  const commentInputRef = useRef(null);

  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  const handleExpandCommentClick = () => {
    setCommentExpanded(!commentExpanded);
  };

  const [deletePresent, { loading }] = useMutation(DELETE_PRESENT_MUTATION, {
    variables: {
      id,
    },
    update,
  });

  const now = new Date().toISOString();

  const [createComment, { data, error, loadingComment }] = useMutation(
    CREATE_COMMENT_MUTATION,
    {
      variables: {
        id: present.id,
        creationTime: now,
        body: comment,
      },
    }
  );

  return (
    <>
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
            <Tooltip title="Comment on post">
              <IconButton
                aria-label="Comment"
                onClick={handleExpandCommentClick}
              >
                <Badge badgeContent="0" color="secondary">
                  <ChatIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            <IconButton
              aria-label="share"
              disabled={loading}
              variant="outlined"
              onClick={() => {
                setConfirmOpen(true);
              }}
            >
              <DeleteOutlineIcon />
            </IconButton>
            <IconButton
              className={clsx(classes.expand, {
                [classes.expandOpen]: expanded,
              })}
              onClick={handleExpandClick}
              aria-expanded={expanded}
              aria-label="show more"
            >
              <ExpandMoreIcon />
            </IconButton>
          </CardActions>
          <Collapse in={commentExpanded} timeout="auto" unmountOnExit>
            <form>
              <Box style={{ margin: '.75rem', position: 'relative' }}>
                <TextField
                  id="outlined-basic"
                  label="Comment"
                  variant="outlined"
                  placeholder=""
                  multiline
                  rows={3}
                  type="text"
                  name="comment"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  ref={commentInputRef}
                  style={{
                    // position: 'absolute',
                    // top: '1rem',
                    marginBottom: '.875rem',
                    width: '100%',
                  }}
                />
                <Box display="flex" justifyContent="flex-end">
                  <Button
                    variant="contained"
                    color="primary"
                    disabled={comment.trim() === ''}
                    onClick={() => {
                      createComment().catch((err) => alert(err.message));
                    }}
                    style={{
                      height: '1.75rem',
                      marginBottom: '.15rem',
                      fontWeight: '200',
                    }}
                    size="small"
                  >
                    Discuss
                  </Button>
                </Box>
              </Box>
            </form>
          </Collapse>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            {present?.comments?.map((comment) => (
              <Card style={{ marginTop: 10 }}>
                <CardHeader
                  avatar={
                    <Avatar aria-label="recipe" className={classes.avatar}>
                      C
                    </Avatar>
                  }
                  action={
                    lifeseed &&
                    lifeseed.name === comment.lifeseed && <Box>Delete</Box>
                  }
                  title={comment.lifeseed}
                  subheader={moment(comment.creationTime).fromNow()}
                />
                <CardContent>
                  <Typography paragraph>{comment.body}</Typography>
                </CardContent>
              </Card>
            ))}
          </Collapse>
        </Card>
      </Box>
      <Dialog open={confirmOpen} fullWidth>
        <Box p={4}>
          <Box m={4}>
            <Typography variant="h5">
              Would you like to delete post <b>{present.name}</b> ?
            </Typography>
          </Box>

          <Box display="flex" justifyContent="flex-end">
            <Button
              variant="outlined"
              color="primary"
              id="cancel"
              onClick={() => setConfirmOpen(false)}
              style={{ marginRight: '7px' }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              id="post"
              type="submit"
              onClick={() => {
                deletePresent().catch((err) => alert(err.message));
              }}
            >
              Delete
            </Button>
          </Box>
        </Box>
      </Dialog>
    </>
  );
}
