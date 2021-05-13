import Link from 'next/link';
import { useMutation } from '@apollo/client';
import { makeStyles } from '@material-ui/core/styles';
import { Box, Button, Dialog, Tooltip } from '@material-ui/core';
import React, { useState } from 'react';
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
import AddCommentSharp from '@material-ui/icons/AddCommentSharp';
import { useLifeseed } from '../admin/useLifeseed';
import CommentPresent from '../common/CommentPresent';
import {
  LOVE_MUTATION,
  SINGLE_PRESENT_QUERY,
  DELETE_PRESENT_MUTATION,
  update,
} from '../common/PresentMutations';

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

export default function Post({ present }) {
  const { id } = present;
  const lifeseed = useLifeseed();
  const classes = useStyles();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [addCommentExpanded, setAddCommentExpanded] = useState(false);
  const [commentsExpanded, setCommentsExpanded] = useState(false);

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

  const [love] = useMutation(LOVE_MUTATION, {
    variables: {
      id,
    },
    refetchQueries: [
      {
        query: SINGLE_PRESENT_QUERY,
        variables: {
          id,
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
            <IconButton
              aria-label="love"
              onClick={() => {
                love().catch((err) => alert(err.message));
              }}
            >
              <Badge badgeContent={present.loves?.length} color="secondary">
                {lifeseed ? (
                  present.loves?.find(
                    (love) => love.lifeseed.id === lifeseed.id
                  ) ? (
                    <FavoriteIcon color="secondary" style={{ color: 'red' }} />
                  ) : (
                    <FavoriteIcon />
                  )
                ) : (
                  <FavoriteIcon />
                )}
              </Badge>
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
              aria-label="delete"
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
          <CommentPresent
            commentsExpanded={commentsExpanded}
            addCommentExpanded={addCommentExpanded}
            present={present}
            lifeseed={lifeseed}
          />
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
