import Link from 'next/link';
import { useMutation } from '@apollo/client';
import gql from 'graphql-tag';
import { makeStyles } from '@material-ui/core/styles';
import {
  Box,
  Button,
  Collapse,
  Dialog,
  Divider,
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
import ForumIcon from '@material-ui/icons/Forum';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import moment from 'moment';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import clsx from 'clsx';
import Badge from '@material-ui/core/Badge';
import ChatIcon from '@material-ui/icons/Chat';
import { AddCommentSharp } from '@material-ui/icons';
import { array } from 'prop-types';
import { useLifeseed } from '../admin/useLifeseed';

const DELETE_PRESENT_MUTATION = gql`
  mutation DELETE_PRESENT_MUTATION($id: ID!) {
    deletePresent(id: $id) {
      id
    }
  }
`;

const DELETE_COMMENT_MUTATION = gql`
  mutation DELETE_COMMENT_MUTATION($id: ID!) {
    deleteComment(id: $id) {
      id
    }
  }
`;

const SINGLE_PRESENT_QUERY = gql`
  query SINGLE_PRESENT_QUERY($id: ID!) {
    present: Present(where: { id: $id }) {
      body
      comments {
        id
        creationTime
        body
        lifeseed {
          id
        }
      }
      creationTime
      id
      lifeseed {
        lifetree {
          image
        }
      }
      name
    }
  }
`;

const CREATE_COMMENT_MUTATION = gql`
  mutation CREATE_COMMENT_MUTATION($id: ID!, $body: String!) {
    createComment(presentId: $id, body: $body) {
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

function updateComment(cache, payload) {
  cache.evict(cache.identify(payload.data.deleteComment));
}

export default function Post({ present, page }) {
  const { id } = present;
  const lifeseed = useLifeseed();
  const classes = useStyles();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [addCommentExpanded, setAddCommentExpanded] = useState(false);
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [comment, setComment] = useState('');
  const commentInputRef = useRef(null);

  const handleAddCommentClick = () => {
    setAddCommentExpanded(!addCommentExpanded);
    setCommentsExpanded(!addCommentExpanded);
  };

  const handleExpandCommentsClick = () => {
    setCommentsExpanded(!commentsExpanded);
  };

  const [deletePresent, { loading }] = useMutation(DELETE_PRESENT_MUTATION, {
    variables: {
      id,
    },
    update,
  });

  const [deleteComment] = useMutation(DELETE_COMMENT_MUTATION, {
    variables: {
      id,
    },
    updateComment,
  });

  const [createComment] = useMutation(CREATE_COMMENT_MUTATION, {
    variables: {
      id: present.id,
      body: comment,
    },
    refetchQueries: [
      {
        query: SINGLE_PRESENT_QUERY,
        variables: {
          id: present.id,
        },
      },
    ],
    awaitRefetchQueries: true,
  });

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
                onClick={handleExpandCommentsClick}
              >
                <Badge
                  badgeContent={present.comments?.length}
                  color="secondary"
                >
                  <ForumIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            <IconButton aria-label="Comment" onClick={handleAddCommentClick}>
              <AddCommentSharp />
            </IconButton>
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
                [classes.expandOpen]: commentsExpanded,
              })}
              onClick={handleExpandCommentsClick}
              aria-expanded={commentsExpanded}
              aria-label="show more"
            >
              <ExpandMoreIcon />
            </IconButton>
          </CardActions>
          <Collapse in={addCommentExpanded} timeout="auto" unmountOnExit>
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
                      setComment('');
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
          <Collapse in={commentsExpanded} timeout="auto" unmountOnExit>
            <Divider style={{ margin: '.3rem .7rem' }} />

            {present?.comments
              ?.slice()
              .reverse()
              .map((comment) => (
                <Box
                  key={comment.id}
                  style={{
                    display: 'grid',
                    justifyContent: 'space-between',
                    gridTemplateColumns: '1fr 5fr 1fr',
                    margin: '.3rem',
                    marginLeft: '.3rem',
                    marginRight: '.3rem',
                    borderRadius: '4px',
                    backgroundColor: '#fafafa',
                  }}
                >
                  <Avatar
                    aria-label="recipe"
                    className={classes.avatar}
                    style={{ margin: '.3rem', transform: 'scale(0.8)' }}
                  >
                    <img
                      src={comment.lifeseed?.lifetree?.image}
                      style={{ height: '100%' }}
                    />
                  </Avatar>
                  <Box
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'left',
                      margin: '.2rem',
                    }}
                  >
                    <Typography variant="body2" paragraph>
                      {comment.body}
                    </Typography>
                    <Typography variant="h5">
                      {moment(comment.creationTime).fromNow()}
                    </Typography>
                  </Box>
                  {lifeseed && lifeseed.id === comment?.lifeseed?.id && (
                    <IconButton
                      size="small"
                      style={{ margin: 'auto', transform: 'scale(0.8)' }}
                      onClick={() => {
                        deleteComment(comment.id);
                      }}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  )}
                </Box>
              ))}
          </Collapse>
        </Card>
      </Box>
      <Dialog open={confirmOpen} fullWidth>
        <Box p={4}>
          <Box m={4}>
            <Typography variant="h4">
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
